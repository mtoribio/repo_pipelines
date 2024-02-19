import * as cdk from 'aws-cdk-lib';
import { PipelineProject, BuildSpec, LinuxBuildImage } from 'aws-cdk-lib/aws-codebuild';
import { createName } from '../../utils/createName';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';

export const infraBuildProjects = (scope: Construct) => {
	// Crear un CodeBuild para Linting
	const linter = new PipelineProject(scope, 'CodeBuildInfraProjectLinting', {
		projectName: createName('codebuild', 'infra-linting'),
		environment: {
			buildImage: LinuxBuildImage.STANDARD_6_0,
		},
		timeout: cdk.Duration.minutes(100),
		buildSpec: BuildSpec.fromObject({
			version: '0.2',
			phases: {
				install: {
					'runtime-versions': {
						nodejs: '16',
					},
					commands: [
						'node -v',
						'npm install -g eslint',
						'npm install eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin',
					],
				},
				build: {
					commands: ['npm run eslint'],
				},
			},
		}),
	});

	// Crear un CodeBuild para Synth
	const synth = new PipelineProject(scope, 'CodeBuildInfraProjectSynth', {
		projectName: createName('codebuild', 'infra-synth'),
		environment: {
			buildImage: LinuxBuildImage.STANDARD_6_0,
		},
		timeout: cdk.Duration.minutes(100),
		buildSpec: BuildSpec.fromObject({
			version: '0.2',
			phases: {
				install: {
					'runtime-versions': {
						nodejs: '16',
					},
					commands: ['node -v', 'sudo npm install -g aws-cdk', 'npm install'],
				},
				build: {
					commands: ['cdk synth'],
				},
			},
			artifacts: {
				'base-directory': '.',
				files: ['**/*'],
				'exclude-paths': ['node_modules/**'],
			},
		}),
	});

	// Crear un CodeBuild para Unit Test
	const unitTest = new PipelineProject(scope, 'CodeBuildInfraProjectUnitTest', {
		projectName: createName('codebuild', 'infra-unit-test'),
		environment: {
			buildImage: LinuxBuildImage.STANDARD_6_0,
		},
		timeout: cdk.Duration.minutes(100),
		buildSpec: BuildSpec.fromObject({
			version: '0.2',
			phases: {
				build: {
					commands: ['echo "Aquí van los Unit Test!"'],
				},
			},
		}),
	});

	// Crear un CodeBuild para Security
	const security = new PipelineProject(scope, 'CodeBuildInfraProjectSecurity', {
		projectName: createName('codebuild', 'infra-security'),
		environment: {
			buildImage: LinuxBuildImage.STANDARD_6_0,
		},
		timeout: cdk.Duration.minutes(100),
		buildSpec: BuildSpec.fromObject({
			version: '0.2',
			phases: {
				install: {
					'runtime-versions': {
						ruby: '3.1',
					},
					commands: ['gem install cfn-nag'],
				},
				build: {
					commands: ['find ./cdk.out -type f -name "*.template.json" | xargs -I{} cfn_nag_scan --input-path {}'],
				},
			},
		}),
	});

	// Crear un CodeBuild para Deploy
	const deploy = new PipelineProject(scope, 'CodeBuildInfraProjectDeploy', {
		projectName: createName('codebuild', 'infra-deploy'),
		environment: {
			buildImage: LinuxBuildImage.STANDARD_6_0,
		},
		timeout: cdk.Duration.minutes(100),
		buildSpec: BuildSpec.fromObject({
			version: '0.2',
			phases: {
				install: {
					'runtime-versions': {
						nodejs: '16',
					},
					commands: ['node -v'],
				},
				build: {
					commands: [
						'rm -rf node_modules',
						'sudo npm install -g aws-cdk',
						'npm install',
						'cdk deploy --all --method=direct --require-approval never',
					],
				},
			},
		}),
	});

	// Conceder permisos al CodeBuild project de deploy
	deploy.addToRolePolicy(
		new iam.PolicyStatement({
			actions: ['sts:AssumeRole'],
			resources: ['*'],
		})
	);

	return {
		linter,
		synth,
		unitTest,
		security,
		deploy,
	};
};
