#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { createName } from '../utils/createName';
import { AppPipelineStack } from '../lib/pipeline-app-stack';
import { dev as env } from '../bin/environments';

const app = new cdk.App();

const { project } = env;

const appPipelineStack = new AppPipelineStack(app, createName('stack', 'app-pipeline'), { env });

cdk.Tags.of(appPipelineStack).add('proyecto', project);
