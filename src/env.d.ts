declare module 'rollup/dist/loadConfigFile' {
  import { MergedRollupOptions, RollupWarning } from 'rollup'

  interface BatchWarnings {
    readonly count: number
    readonly warningOccurred: Map<any, any>
    add(warning: Warnings): void
    flush(): void
  }

  function loadConfigFile(
    configFilePath: string
  ): Promise<{ options: MergedRollupOptions[]; warnings: BatchWarnings }>

  export function handleError(err: Error, recover = false): void
  export default loadConfigFile
}

declare module 'rollup/dist/shared/loadConfigFile' {
  export function handleError(err: any, recover = false): void
  export function stderr(text: string): void
  export function cyan(text: string): string
  export function bold(text: string): string
  export function green(text: string): string
}
