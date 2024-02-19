import * as cdk from 'aws-cdk-lib';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import { Construct } from 'constructs';
import { createName } from '../utils/createName';
import { Pipeline, PipelineType } from 'aws-cdk-lib/aws-codepipeline';
import { infraBuildActions } from './pipelinebuildactions/infra-actions';

export interface InfraPipelineStackProps extends cdk.StackProps {
	env: {
		region: string;
		project: string;
		environment: string;
		ownerAccount: string;
		infraRepo: string;
		infraBranch: string;
	};
}

export class InfraPipelineStack extends cdk.Stack {
	constructor(scope: Construct, id: string, props: InfraPipelineStackProps) {
		super(scope, id, props);

		// Crear un CodeCommit repository
		new codecommit.Repository(this, 'InfraRepository', {
			repositoryName: createName('codecommit', 'infra-repo'),
		});

		// Crear los build actions
		const actions = infraBuildActions(this, props);

		// Create CodePipeline
		new Pipeline(this, 'InfraPipeline', {
			pipelineName: createName('codepipeline', 'infra-pipeline'),
			pipelineType: PipelineType.V1,
			enableKeyRotation: true,
			stages: [
				{
					stageName: createName('stage', 'source'),
					actions: [actions.source],
				},
				{
					stageName: createName('stage', 'linting'),
					actions: [actions.linting],
				},
				{
					stageName: createName('stage', 'synth'),
					actions: [actions.synth],
				},
				{
					stageName: createName('stage', 'unit-test'),
					actions: [actions.unitTest],
				},
				{
					stageName: createName('stage', 'security'),
					actions: [actions.security],
				},
				{
					stageName: createName('stage', 'deploy'),
					actions: [actions.deploy],
				},
			],
		});
	}
}
