import * as cdk from 'aws-cdk-lib';
import { PipelineProject, BuildSpec, LinuxBuildImage } from 'aws-cdk-lib/aws-codebuild';
import { createName } from '../../utils/createName';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface AppBuildProjectsProps {
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

export const appBuildProjects = (scope: Construct, props: AppBuildProjectsProps) => {
	// Crear un CodeBuild para Linting
	const linter = new PipelineProject(scope, 'CodeBuildAppProjectLinting', {
		projectName: createName('codebuild', 'app-linting'),
		environment: {
			buildImage: LinuxBuildImage.fromCodeBuildImageId('aws/codebuild/amazonlinux2-aarch64-standard:3.0'),
		},
		timeout: cdk.Duration.minutes(100),
		buildSpec: BuildSpec.fromObject({
			version: '0.2',
			phases: {
				install: {
					'runtime-versions': {
						php: '8.1',
						nodejs: '18',
					},
					// commands: ['composer install', 'npm install -g eslint', 'npm install eslint-plugin-php'],
				},
				build: {
					// commands: ['php artisan lint'],
					commands: ['echo "Aquí debe configurar el linter'],
				},
			},
		}),
	});

	// Crear un CodeBuild para Unit Test
	const unitTest = new PipelineProject(scope, 'CodeBuildAppProjectUnitTest', {
		projectName: createName('codebuild', 'app-unit-test'),
		environment: {
			buildImage: LinuxBuildImage.STANDARD_7_0,
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
	const security = new PipelineProject(scope, 'CodeBuildAppProjectSecurity', {
		projectName: createName('codebuild', 'app-security'),
		environment: {
			buildImage: LinuxBuildImage.STANDARD_7_0,
		},
		environmentVariables: {
			SONAR_HOST_URL: { value: 'URL_de_tu_servidor_de_SonarQube' },
			SONAR_LOGIN: { value: 'token_de_autenticacion_de_SonarQube' },
		},
		timeout: cdk.Duration.minutes(100),
		buildSpec: BuildSpec.fromObject({
			version: '0.2',
			phases: {
				build: {
					// commands: ['npm install -g sonarqube-scanner', 'sonar-scanner'],
					commands: ['echo "Aquí debe configurar el sonarqube para su proyecto"'],
				},
			},
		}),
	});

	const envId = createName('sm', 'env');
	const nameRepository = createName('ecr', 'repository');
	// Crear un CodeBuild para Build
	const build = new PipelineProject(scope, 'CodeBuildAppProjectBuild', {
		projectName: createName('codebuild', 'app-build'),
		environment: {
			buildImage: LinuxBuildImage.STANDARD_7_0,
			privileged: true,
		},
		timeout: cdk.Duration.minutes(100),
		buildSpec: BuildSpec.fromObject({
			version: '0.2',
			phases: {
				install: {
					'runtime-versions': {
						nodejs: '18',
					},
					commands: ['node -v', 'sudo npm install -g aws-cdk', 'npm install'],
				},
				build: {
					commands: [
						`SECRET_VALUE=$(aws secretsmanager get-secret-value --secret-id ${envId} --query SecretString --output text)`,
						'echo "$SECRET_VALUE" > .env',
						`docker build -t ${nameRepository} .`,
						`docker tag ${nameRepository}:latest ${props.env.accountId}.dkr.ecr.${props.env.region}.amazonaws.com/${nameRepository}:latest`,
						`docker push ${props.env.accountId}.dkr.ecr.${props.env.region}.amazonaws.com/${nameRepository}:latest`,
					],
				},
			},
			artifacts: {
				'base-directory': '.',
				files: ['**/*'],
				'exclude-paths': ['node_modules/**'],
			},
		}),
	});

	const nameContainer = createName('ecs', 'container');
	const taskDefinitionFamily = createName('ecs', 'task');
	const nameGroupLogs = createName('cw', 'ecs-logs');
	const nameTaskRole = createName('iam', 'task-execution-role');
	const nameCluster = createName('ecs', 'cluster');
	const nameService = createName('ecs', 'service');
	// Crear un CodeBuild para Deploy
	const deploy = new PipelineProject(scope, 'CodeBuildAppProjectDeploy', {
		projectName: createName('codebuild', 'app-deploy'),
		environment: {
			buildImage: LinuxBuildImage.STANDARD_7_0,
		},
		timeout: cdk.Duration.minutes(100),
		buildSpec: BuildSpec.fromObject({
			version: '0.2',
			phases: {
				install: {
					'runtime-versions': {
						nodejs: '18',
					},
					commands: ['node -v'],
				},
				build: {
					commands: [
						`aws ecs register-task-definition --cli-input-json '{
							"family": "${taskDefinitionFamily}",
							"containerDefinitions": [
								{
									"name": "${nameContainer}",
									"image": "${props.env.accountId}.dkr.ecr.${props.env.region}.amazonaws.com/${nameRepository}:latest",
									"cpu": 0,
									"portMappings": [
										{
											"name": "${nameContainer}-8000-tcp",
											"containerPort": 8000,
											"hostPort": 8000,
											"protocol": "tcp"
										}
									],
									"essential": true,
									"environment": [],
									"environmentFiles": [],
									"mountPoints": [],
									"volumesFrom": [],
									"dockerSecurityOptions": [],
									"ulimits": [],
									"logConfiguration": {
										"logDriver": "awslogs",
										"options": {
											"awslogs-group": "${nameGroupLogs}",
											"awslogs-region": "${props.env.region}",
											"awslogs-stream-prefix": "ecs"
										},
										"secretOptions": []
									},
									"systemControls": [],
									"credentialSpecs": []
								}
							],
							"taskRoleArn": "arn:aws:iam::${props.env.accountId}:role/hrmgo-${props.env.region}-stack-${props.env.environment}-TaskDefinitionTaskRoleFD4-r2TzM6S8v4SA",
							"executionRoleArn": "arn:aws:iam::${props.env.accountId}:role/${nameTaskRole}",
							"networkMode": "awsvpc",
							"requiresCompatibilities": ["FARGATE"],
							"cpu": "2048",
							"memory": "4096",
							"runtimePlatform": {
								"operatingSystemFamily": "LINUX"
							},
							"tags": [
								{
									"key": "proyecto",
									"value": "hrmgo"
								}
							]
						}'
					`,
						`aws ecs update-service --cluster ${nameCluster} --service ${nameService} --task-definition ${taskDefinitionFamily}`,
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
		unitTest,
		security,
		build,
		deploy,
	};
};
