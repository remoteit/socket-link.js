import {spawn} from 'child_process'
import {Command} from 'commander'
import format from 'string-template'
// @ts-ignore
import {version} from '../package.json'
import {WarpProxy} from './warp'

(async () => {
  const program = new Command()

  program
    .name('warp')
    .description('Remote.It WARP CLI')
    .version(version)
    .argument('<target>', 'the target service key')
    .argument('[command...]', 'command line to execute')
    .option('-h, --host <host>', 'host to bind to', '127.0.0.1')
    .option('-p, --port <port>', 'port number')
    .option('--profile <profile>', 'credential profile name in the credentials file', 'DEFAULT')
    .action(async (target, template, options) => {
      const proxy = new WarpProxy(target, options)

      const port = await proxy.open()

      const command = template.map((arg: string) => format(arg, {host: options.host, port}))

      await new Promise((resolve, reject) => {
        const process = spawn(command.shift(), command, {stdio: 'inherit'})

        process.on('exit', resolve)
        process.on('error', reject)
      })

      await proxy.close()
    })
    .parse()
})()
