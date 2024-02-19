import * as cdk from 'aws-cdk-lib';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import { Construct } from 'constructs';
import { createName } from '../utils/createName';
import { Pipeline, PipelineType } from 'aws-cdk-lib/aws-codepipeline';
import { cicdBuildActions } from './pipelinebuildactions/cicd-actions';

export interface CiCdBuildActionsProps extends cdk.StackProps {
	env: {
		region: string;
		project: string;
		environment: string;
		ownerAccount: string;
		cicdRepo: string;
		cicdBranch: string;
	};
}

export class CiCdPipelineStack extends cdk.Stack {
	constructor(scope: Construct, id: string, props: CiCdBuildActionsProps) {
		super(scope, id, props);

		// Crear un CodeCommit repository
		new codecommit.Repository(this, 'CiCdRepository', {
			repositoryName: createName('codecommit', 'cicd-repo'),
		});

		// Crear los build actions
		const actions = cicdBuildActions(this, props);

		// Create CodePipeline
		new Pipeline(this, 'CiCdPipeline', {
			pipelineName: createName('codepipeline', 'cicd-pipeline'),
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
					stageName: createName('stage', 'deploy'),
					actions: [actions.deploy],
				},
			],
		});
	}
}
