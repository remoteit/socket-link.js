import {spawn} from 'child_process'
import {Command} from 'commander'
import format from 'string-template'
import {
  DEFAULT_CREDENTIALS,
  DEFAULT_PROFILE,
  DEFAULT_ROUTER,
  LOCALHOST,
  PROGRAM_DESCRIPTION,
  PROGRAM_NAME,
  PROGRAM_VERSION
} from './constants'
import {WarpProxy} from './warp'

(async () => {
  const program = new Command()

  program
    .name(PROGRAM_NAME)
    .description(PROGRAM_DESCRIPTION)
    .version(PROGRAM_VERSION)
    .argument('<target>', 'the target service key')
    .argument('[command...]', 'command line to execute')
    .option('-h, --host <host>', 'host to bind to', LOCALHOST)
    .option('-p, --port <port>', 'port number')
    .option('--router <router>', 'Remote.It WARP router hostname', DEFAULT_ROUTER)
    .option('--credentials <credentials>', 'path to the Remote.It credentials file', DEFAULT_CREDENTIALS)
    .option('--profile <profile>', 'credential profile name in the credentials file', DEFAULT_PROFILE)
    .action(async (target, template, options) => {
      try {
        const proxy = new WarpProxy(target, options)

        const port = await proxy.open()

        const command = template.map((arg: string) => format(arg, {host: options.host, port}))

        await new Promise((resolve, reject) => {
          const process = spawn(command.shift(), command, {stdio: 'inherit'})

          process.on('exit', resolve)
          process.on('error', reject)
        })

        await proxy.close()
      } catch (error: any) {
        console.error(`ERROR: ${error.message || error}`)
      }
    })
    .parse()
})()
