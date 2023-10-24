import {spawn} from 'child_process'
import {Command, Option} from 'commander'
import format from 'string-template'
import {DEFAULT_CREDENTIALS, LOCALHOST, PROGRAM_DESCRIPTION, PROGRAM_NAME, PROGRAM_VERSION} from './constants'
import {WarpProxy} from './warp'

(async () => {
  const program = new Command()

  program
    .name(PROGRAM_NAME)
    .description(PROGRAM_DESCRIPTION)
    .version(PROGRAM_VERSION, '-v, --version', `return the current version: "${PROGRAM_VERSION}"`)
    .helpOption('-?, --help', 'return this help text')
    .addOption(new Option('-d, --debug', 'enable debug output'))
    .addOption(new Option('-h, --host <host>', 'host to bind to').default(LOCALHOST))
    .addOption(new Option('-p, --port <port>', 'TCP port number').default(null, 'scan available').argParser(parseInt))
    .addOption(new Option('-u, --udp <port>', 'UDP port number').argParser(parseInt).conflicts('port'))
    .addOption(new Option('--credentials <credentials>', 'path to the Remote.It credentials file').default(DEFAULT_CREDENTIALS))
    .addOption(new Option('--profile <profile>', 'credential profile name in the credentials file'))
    .addOption(new Option('--router <router>', 'Remote.It WARP router hostname').hideHelp())
    .argument('<target>', 'the target service key')
    .argument('[command...]', 'command line to execute')
    .action(async (target, template, options) => {
      if (!template) return program.help()

      const proxy = new WarpProxy(target, options)

      try {
        const port = await proxy.open()

        const command = template.map((arg: string) => format(arg, {host: options.host, port}))

        if (options.debug) console.error('WARP: running: %s', command.join(' '))

        await new Promise((resolve, reject) => {
          const process = spawn(command.shift(), command, {stdio: 'inherit'})

          process.on('exit', resolve)
          process.on('error', reject)
        })
      } catch (error: any) {
        console.error(`ERROR: ${error.message || error}`)
      } finally {
        await proxy.close()
      }
    })
    .parse()
})()
