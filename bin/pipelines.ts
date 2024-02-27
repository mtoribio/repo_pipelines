#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { AppPipelineStack } from '../lib/pipeline-app-stack';

import { environments } from './environments';

const app = new cdk.App();

const config: string = app.node.tryGetContext('config');
if (!config) throw new Error("Context variable missing on CDK command. Pass in as '-c config=XXX'");

const env = environments[config];
const { project, region, environment } = env;

export const createName = (resource: string, functionality: string) =>
	`${project}-${region}-${resource}-${environment}-${functionality}`;

const appPipelineStack = new AppPipelineStack(app, createName('stack', 'app-pipeline'), { env });

cdk.Tags.of(appPipelineStack).add('proyecto', project);
