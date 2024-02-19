#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { PipelinesStack } from '../lib/pipelines-stack';

const app = new cdk.App();
new PipelinesStack(app, 'PipelinesStack');
