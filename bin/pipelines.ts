#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { createName } from '../utils/createName';
import { InfraPipelineStack } from '../lib/pipeline-infra-stack';

import { dev as env } from '../bin/environments';

const app = new cdk.App();

const { project } = env;

const infraPipelineStack = new InfraPipelineStack(app, createName('stack', 'infra-pipeline'), { env });

cdk.Tags.of(infraPipelineStack).add('proyecto', project);
