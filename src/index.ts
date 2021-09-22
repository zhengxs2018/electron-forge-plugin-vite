import path from 'path'
import { asyncOra } from '@electron-forge/async-ora'
import type {
  IForgePlugin,
  ElectronProcess,
} from '@electron-forge/shared-types'
import { build, createServer, ViteDevServer, InlineConfig } from 'vite'
import { rollup, watch, RollupWatcher } from 'rollup'
import loadConfigFile from 'rollup/dist/loadConfigFile'
import { handleError } from 'rollup/dist/shared/loadConfigFile'

export interface VitePluginConfig {
  mainRoot?: string
  configFile?: string
  renderer?: InlineConfig
}

// 真奇葩，为什么要改 startLogic 的 this
export default function (config: VitePluginConfig = {}): IForgePlugin {
  let alreadyStarted = false

  // 主进程配置
  let mainRoot: string | null = config.mainRoot || null
  let mainWatcher: RollupWatcher | null = null

  // 渲染进程配置与服务
  let rendererConfig: InlineConfig = config.renderer || {}
  let rendererServer: ViteDevServer | null = null

  async function launchRendererServer() {
    await asyncOra('启动渲染服务', async () => {
      rendererServer = await createServer(rendererConfig)
      await rendererServer.listen()

      // 将 vite 服务添加到环境变量
      const serverPort = rendererServer.config.server.port!
      process.env.ELECTRON_RENDERER_TARGET = `http://localhost:${serverPort}`
    })
  }

  async function compileMain(enableWatch?: boolean): Promise<void> {
    await asyncOra('编译主进程代码', async () => {
      const configFilePath = path.resolve(
        mainRoot!,
        config.configFile || 'rollup.config.js'
      )
      const { options: configs, warnings } = await loadConfigFile(
        configFilePath
      )

      for (const options of configs) {
        const bundle = await rollup(options)
        await Promise.all(options.output.map(bundle.write))
      }

      if (enableWatch) {
        mainWatcher = watch(configs)
        mainWatcher.on('event', event => {
          switch (event.code) {
            case 'BUNDLE_END':
              break
            case 'ERROR':
              warnings.flush()
              handleError(event.error, true)
              break
          }

          if ('result' in event && event.result) {
            event.result.close().catch(error => handleError(error, true))
          }
        })
      }
    })
  }

  async function compileRenderer() {
    await asyncOra('编译渲染进程代码', async () => {
      await build(rendererConfig)
    })
  }

  function exitHandler(
    options: { cleanup?: boolean; exit?: boolean },
    err?: Error
  ): void {
    if (options.cleanup) {
      mainWatcher?.close()
      rendererServer?.close()
    }

    if (err) console.error(err.stack)
    // Why: This is literally what the option says to do.
    // eslint-disable-next-line no-process-exit
    if (options.exit) process.exit()
  }

  return {
    name: 'vite',
    __isElectronForgePlugin: true,
    init(dir: string) {
      if (!mainRoot) mainRoot = dir

      process.on('exit', () => exitHandler({ cleanup: true }))
      process.on('SIGINT', () => exitHandler({ exit: true }))
    },
    getHook(name) {
      if (name === 'readPackageJson') {
        return async (_, packageJson) => {
          if (packageJson.config) {
            delete packageJson.config.forge
          }

          // todo 需要像 @electron-forge/plugin-webpack 一样清理么？
          const electronVersion = packageJson.devDependencies['electron']
          packageJson.devDependencies = {
            electron: electronVersion,
          }

          delete packageJson.scripts
          delete packageJson.workspaces
          delete packageJson.dependencies
          delete packageJson.optionalDependencies
          delete packageJson.peerDependencies

          return packageJson
        }
      }

      if (name === 'prePackage') {
        return async () => {
          await compileMain()
          await compileRenderer()
        }
      }

      if (name === 'postStart') {
        return async (_, child: ElectronProcess) => {
          child.on('exit', () => {
            if (child.restarted) return
            exitHandler({ cleanup: true, exit: true })
          })
        }
      }

      return null
    },
    async startLogic(): Promise<false> {
      if (alreadyStarted) return false
      alreadyStarted = true

      // 打包主进程和渲染进程
      await compileMain(true)
      await launchRendererServer()

      return false
    },
  }
}

// async function loadAndParseConfigFile(cwd: string, configFile?: string): Promise<MergedRollupOptions[]> {
//   const configFilePath = path.resolve(cwd, configFile || 'rollup.config.js')
//   await loadConfigFile(configFilePath)

//   warnings.flush()

//   return configs
// }
