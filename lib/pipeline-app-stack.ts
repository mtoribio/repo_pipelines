import * as cdk from 'aws-cdk-lib';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import { Construct } from 'constructs';
import { createName } from '../utils/createName';
import { Pipeline, PipelineType } from 'aws-cdk-lib/aws-codepipeline';
import { appBuildActions } from './pipelinebuildactions/app-actions';

export interface AppPipelineStackProps extends cdk.StackProps {
	env: {
		region: string;
		project: string;
		environment: string;
		ownerAccount: string;
		appRepo: string;
		appBranch: string;
		accountId: string;
	};
}

export class AppPipelineStack extends cdk.Stack {
	constructor(scope: Construct, id: string, props: AppPipelineStackProps) {
		super(scope, id, props);

		// Crear un CodeCommit repository
		new codecommit.Repository(this, 'AppRepository', {
			repositoryName: createName('codecommit', 'app-repo'),
		});

		// Crear los build actions
		const actions = appBuildActions(this, props);

		// Create CodePipeline
		new Pipeline(this, 'AppPipeline', {
			pipelineName: createName('codepipeline', 'app-pipeline'),
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
					stageName: createName('stage', 'deploy-wave-1'),
					actions: [actions.deployWave1],
				},
				{
					stageName: createName('stage', 'build'),
					actions: [actions.build],
				},
				{
					stageName: createName('stage', 'manual-approval'),
					actions: [actions.manualApproval],
				},
				{
					stageName: createName('stage', 'deploy-wave-2'),
					actions: [actions.deployWave2],
				},
			],
		});
	}
}
