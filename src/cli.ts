import {spawn} from 'child_process'
import {Command, Option} from 'commander'
import format from 'string-template'
import {WarpClient} from './client'
import {DEFAULT_CREDENTIALS, LOCALHOST, PROGRAM_DESCRIPTION, PROGRAM_NAME, PROGRAM_VERSION} from './constants'

(async () => {
    const program = new Command()

    program.name(PROGRAM_NAME)
        .description(PROGRAM_DESCRIPTION)
        .version(PROGRAM_VERSION, '-v, --version', `return the current version: "${PROGRAM_VERSION}"`)
        .helpOption('-h, --help', 'return this help text')
        .addOption(new Option('-d, --debug', 'enable debug output'))
        .addOption(new Option('--credentials <credentials>', 'path to the Remote.It credentials file').default(DEFAULT_CREDENTIALS))
        .addOption(new Option('--profile <profile>', 'credential profile name in the credentials file'))
        .addOption(new Option('--router <router>', 'Remote.It WARP router hostname').hideHelp())
        .enablePositionalOptions()

    program.command('api')
        .description('Execute GraphQL query')
        .argument('<query>', 'query to execute')
        .addOption(new Option('-v, --variables <json>', 'query variables').argParser(value => JSON.parse(value)))
        .action(async (query, options) => {
            const warp = new WarpClient(program.opts())

            const result = await warp.api(query, options.variables)

            console.log(JSON.stringify(result, null, 2))
        })

    program.command('connect')
        .description('Connect to a WARP service')
        .argument('<target>', 'the target service key')
        .argument('[command...]', 'command line to execute, {address} and {port} will be replaced with the proxy address and port')
        .addOption(new Option('-b, --bind <address>', 'address to bind to').default(LOCALHOST))
        .addOption(new Option('-p, --port <port>', 'TCP port number').default(null, 'scan available').argParser(parseInt))
        .addOption(new Option('-u, --udp <port>', 'UDP port number').argParser(parseInt).conflicts('port'))
        .action(async (target, template, options, command) => {
            if (!template?.length) return command.help()

            const warp = new WarpClient(program.opts())

            const proxy = await warp.connect(target, options)

            const execute = template.map((arg: string) => format(arg, proxy.address))

            if (warp.debug) console.error('WARP: %s', execute.join(' '))

            await new Promise((resolve, reject) => {
                const process = spawn(execute.shift(), execute, {stdio: 'inherit'})

                process.on('exit', resolve)
                process.on('error', reject)
            })

            await proxy.close()
        })

    try {
        await program.parseAsync(process.argv)
    } catch (error: any) {
        console.error(`ERROR: ${error.message || error}`)
    }
})()
