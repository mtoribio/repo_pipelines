#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { createName } from '../utils/createName';
import { InfraPipelineStack } from '../lib/pipeline-infra-stack';
import { CiCdPipelineStack } from '../lib/pipeline-cicd-stack';

import { dev as env } from '../bin/environments';

const app = new cdk.App();

const { project } = env;

const infraPipelineStack = new InfraPipelineStack(app, createName('stack', 'infra-pipeline'), { env });
const cicdPipelineStack = new CiCdPipelineStack(app, createName('stack', 'cicd-pipeline'), { env });

cdk.Tags.of(infraPipelineStack).add('proyecto', project);
cdk.Tags.of(cicdPipelineStack).add('proyecto', project);
