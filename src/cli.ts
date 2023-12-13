import {spawn} from 'child_process'
import {Command, Option} from 'commander'
import format from 'string-template'
import {SocketLink} from '.'
import {DEFAULT_CONFIG, LOCALHOST, PROGRAM_DESCRIPTION, PROGRAM_NAME, PROGRAM_VERSION} from './constants'

(async () => {
  const program = new Command()

  program.name(PROGRAM_NAME)
         .description(PROGRAM_DESCRIPTION)
         .version(PROGRAM_VERSION, '-v, --version', `return the current version: "${PROGRAM_VERSION}"`)
         .helpOption('-h, --help', 'return this help text')
         .addOption(new Option('-d, --debug', 'enable debug output'))
         .addOption(new Option('-c, --config <directory>', 'path to the Remote.It configuration files').default(DEFAULT_CONFIG))
         .addOption(new Option('-p, --profile <name>', 'credential profile name'))
         .addOption(new Option('-r, --router <host>', 'Remote.It socket-link router hostname').hideHelp())
         .enablePositionalOptions()

  program.command('api')
         .description('Execute GraphQL query')
         .argument('<query>', 'query to execute')
         .addOption(new Option('-v, --variables <json>', 'query variables').argParser(value => JSON.parse(value)))
         .action(async (query, options) => {
           const socketLink = new SocketLink(program.opts())

           const result = await socketLink.api(query, options.variables)

           console.log(JSON.stringify(result, null, 2))
         })

  program.command('connect')
         .description('Connect to a socket-link service')
         .argument('<target>', 'the target service key')
         .argument('[command...]', 'command line to execute, {address} and {port} will be replaced with the proxy address and port')
         .addOption(new Option('-b, --bind <address>', 'address to bind to').default(LOCALHOST))
         .addOption(new Option('-p, --port <port>', 'port number').default(null, 'scan available').argParser(parseInt))
         .addOption(new Option('-u, --udp', 'UDP'))
         .action(async (target, template, options, command) => {
           if (!template?.length) return command.help()

           const socketLink = new SocketLink(program.opts())

           const proxy = await socketLink.connect(target, options)

           const address = proxy.address

           const execute = template.map((arg: string) => format(arg, {
             address: address.address,
             port: address.port,
             host: `${address.address}:${address.port}`
           }))

           if (socketLink.debug) console.error('socket-link: %s', execute.join(' '))

           await new Promise((resolve, reject) => {
             const process = spawn(execute.shift(), execute, {stdio: 'inherit'})

             process.on('exit', resolve)
             process.on('error', reject)
           })

           await proxy.close()
         })

  program.command('register')
         .description('Register a socket-link service')
         .addOption(new Option('-h, --host <host>', 'host to connect to').default(LOCALHOST))
         .addOption(new Option('-p, --port <port>', 'port number').argParser(parseInt))
         .addOption(new Option('-u, --udp', 'UDP'))
         .action(async (target, template, options, command) => {
           const socketLink = new SocketLink(program.opts())

           await socketLink.register(options)
         })

  try {
    await program.parseAsync(process.argv)
  } catch (error: any) {
    console.error(`ERROR: ${error.message || error}`)
  }
})()
