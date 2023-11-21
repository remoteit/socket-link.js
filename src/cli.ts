import {spawn} from 'child_process'
import {Command, Option} from 'commander'
import format from 'string-template'
import {WarpClient} from './client'
import {DEFAULT_CREDENTIALS, LOCALHOST, PROGRAM_DESCRIPTION, PROGRAM_NAME, PROGRAM_VERSION} from './constants'

(async () => {
  const program = new Command()

  program
    .name(PROGRAM_NAME)
    .description(PROGRAM_DESCRIPTION)
    .version(PROGRAM_VERSION, '-v, --version', `return the current version: "${PROGRAM_VERSION}"`)
    .helpOption('-h, --help', 'return this help text')
    .addOption(new Option('-d, --debug', 'enable debug output'))
    .addOption(new Option('-b, --bind <address>', 'address to bind to').default(LOCALHOST))
    .addOption(new Option('-p, --port <port>', 'TCP port number').default(null, 'scan available').argParser(parseInt))
    .addOption(new Option('-u, --udp <port>', 'UDP port number').argParser(parseInt).conflicts('port'))
    .addOption(new Option('--credentials <credentials>', 'path to the Remote.It credentials file').default(DEFAULT_CREDENTIALS))
    .addOption(new Option('--profile <profile>', 'credential profile name in the credentials file'))
    .addOption(new Option('--router <router>', 'Remote.It WARP router hostname').hideHelp())
    .argument('<target>', 'the target service key')
    .argument('[command...]', 'command line to execute, {address} and {port} will be replaced with the proxy address and port')
    .action(async (target, template, options) => {
      if (!template) return program.help()

      const {debug, router, credentials, profile, bind, port, udp} = options

      const warp = new WarpClient({debug, router, credentials, profile})

      const proxy = await warp.connect(target, {bind, port, udp})

      try {
        const command = template.map((arg: string) => format(arg, proxy.address))

        if (debug) console.error('WARP: %s', command.join(' '))

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
