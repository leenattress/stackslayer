import arg from 'arg';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { getStacks, getStackResources, slayTheStack } from './slayer'
import listAwsProfiles from 'list-aws-profiles';
// import { loggers } from 'winston';
const { Table } = require('console-table-printer');

function gethelp() {
    console.log(
        `
usage: ${chalk.red('stackslayer')} ${chalk.gray('[options]')}

    ${chalk.blue('options')}:
        ${chalk.green('--profile')}    Your AWS profile
        ${chalk.green('--region')}     The region your stack is located
        ${chalk.green('--stack')}      The cfn stack we are slaying
        ${chalk.green('--action')}     Can be one of '${chalk.red('slay')}' or '${chalk.gray('dryrun')}'
        ${chalk.green('--version')}    Version of the slayer
        ${chalk.green('--verbose')}    More noise in the console
        ${chalk.green('--help')}       This help

example:
${chalk.red('stackslayer')} ${chalk.green('--profile')}=${chalk.gray('myprofile')} ${chalk.green('--region')}=${chalk.gray('eu-west-1')} ${chalk.green('--stack')}=${chalk.gray('mycfnstackname')} ${chalk.green('--action')}=${chalk.red('slay')}

Start the slayer with no options for a wild interactive ride
to gather the information we need:
${chalk.red('stackslayer')} 
`
    )
}

function parseArgumentsIntoOptions(rawArgs) {
    const args = arg({
        '--profile': String,
        '--region': String,
        '--stack': String,
        '--help': Boolean,
        '--verbose': Boolean,
        '--action': String
    }, {
        argv: rawArgs.slice(2),
    });
    return {
        profile: args['--profile'] || false,
        region: args['--region'] || false,
        stack: args['--stack'] || false,
        verbose: args['--verbose'] || false,
        help: args['--help'] || false,
    };
}

async function promptForMissingOptions(options) {

    const questions1 = [];
    if (!options.profile) {
        questions1.push({
            type: 'list',
            name: 'profile',
            message: 'Select a profile',
            choices: await listAwsProfiles()
        });
    }
    if (!options.region) {
        questions1.push({
            type: 'list',
            name: 'region',
            message: 'Select a region',
            choices: ['us-east-1', 'eu-west-1', 'eu-west-2']
        });
    }
    const answers1 = await inquirer.prompt(questions1);

    const questions2 = [];

    // get stacks
    const stacks = await getStacks(answers1)
    const stackNames = stacks.Stacks.map((stack) => { return stack.StackName })


    if (!options.stack) {
        questions2.push({
            type: 'list',
            name: 'stack',
            message: 'Select a stack to slay',
            choices: stackNames
        });
    }
    const answers2 = await inquirer.prompt(questions2);

    const p = new Table({
        columns: [
            { name: 'Logical Resource Id', alignment: 'right' },
            { name: 'Resource Type', alignment: 'right' },
            { name: 'Resource Status', alignment: 'right' },
        ],
    });
    const thisStackResources = await getStackResources({ stack: answers2.stack, region: answers1.region, profile: answers1.profile });
    thisStackResources.StackResourceSummaries.forEach(function(v) {
        delete v.LastUpdatedTimestamp
        delete v.DriftInformation
        delete v.PhysicalResourceId
        p.addRow({
            'Logical Resource Id': v.LogicalResourceId,
            'Resource Type': v.ResourceType,
            'Resource Status': v.ResourceStatus,
        }, { color: v.ResourceStatus === 'CREATE_COMPLETE' ? 'green' : 'red' });
    });
    p.printTable();

    // Begin the slaying?
    const questions3 = [];
    questions3.push({
        type: 'list',
        name: 'slay',
        message: 'Slay the stack?',
        choices: [
            { name: '❌ No', value: 'no' },
            { name: '❌ No', value: 'no' },
            { name: '❌ No', value: 'no' },
            { name: '❎ Dry run, no deletes', value: 'dryrun' },
            { name: '✅ Slay the stack!', value: 'slay' }
        ]
    });
    const answers3 = await inquirer.prompt(questions3);

    return {
        ...options,
        profile: options.profile || answers1.profile,
        region: options.region || answers1.region,
        stack: options.stack || answers2.stack,
        slay: answers3.slay
    };
}

export async function cli(args) {
    let options = parseArgumentsIntoOptions(args);
    if (options.help) {
        gethelp();
        process.exit()
    }

    options = await promptForMissingOptions(options);

    if (options.slay === 'slay') {
        console.log(
            chalk.red(`
  ██████ ▄▄▄█████▓ ▄▄▄       ▄████▄   ██ ▄█▀     ██████  ██▓    ▄▄▄       ██▓ ███▄    █ 
▒██    ▒ ▓  ██▒ ▓▒▒████▄    ▒██▀ ▀█   ██▄█▒    ▒██    ▒ ▓██▒   ▒████▄    ▓██▒ ██ ▀█   █ 
░ ▓██▄   ▒ ▓██░ ▒░▒██  ▀█▄  ▒▓█    ▄ ▓███▄░    ░ ▓██▄   ▒██░   ▒██  ▀█▄  ▒██▒▓██  ▀█ ██▒
  ▒   ██▒░ ▓██▓ ░ ░██▄▄▄▄██ ▒▓▓▄ ▄██▒▓██ █▄      ▒   ██▒▒██░   ░██▄▄▄▄██ ░██░▓██▒  ▐▌██▒
▒██████▒▒  ▒██▒ ░  ▓█   ▓██▒▒ ▓███▀ ░▒██▒ █▄   ▒██████▒▒░██████▒▓█   ▓██▒░██░▒██░   ▓██░
▒ ▒▓▒ ▒ ░  ▒ ░░    ▒▒   ▓▒█░░ ░▒ ▒  ░▒ ▒▒ ▓▒   ▒ ▒▓▒ ▒ ░░ ▒░▓  ░▒▒   ▓▒█░░▓  ░ ▒░   ▒ ▒ 
░ ░▒  ░ ░    ░      ▒   ▒▒ ░  ░  ▒   ░ ░▒ ▒░   ░ ░▒  ░ ░░ ░ ▒  ░ ▒   ▒▒ ░ ▒ ░░ ░░   ░ ▒░
░  ░  ░    ░        ░   ▒   ░        ░ ░░ ░    ░  ░  ░    ░ ░    ░   ▒    ▒ ░   ░   ░ ░ 
      ░                 ░  ░░ ░      ░  ░            ░      ░  ░     ░  ░ ░           ░ 
                            ░                                                           
`)
        )

    }
    slayTheStack(options)
}