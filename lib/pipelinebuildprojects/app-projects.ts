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
	const linter = new PipelineProject(scope, 'CodeBuildProjectLinting', {
		projectName: createName('codebuild', 'linting'),
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
					commands: ['cd ./cdk-code', 'npm install', 'npm run eslint'],
				},
			},
		}),
	});

	// Crear un CodeBuild para Synth
	const synth = new PipelineProject(scope, 'CodeBuildProjectSynth', {
		projectName: createName('codebuild', 'synth'),
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
					commands: ['node -v', 'sudo npm install -g aws-cdk'],
				},
				build: {
					commands: ['cd ./cdk-code', 'npm install', 'cdk synth'],
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
	const unitTest = new PipelineProject(scope, 'CodeBuildProjectUnitTest', {
		projectName: createName('codebuild', 'unit-test'),
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
	const security = new PipelineProject(scope, 'CodeBuildProjectSecurity', {
		projectName: createName('codebuild', 'security'),
		environment: {
			buildImage: LinuxBuildImage.STANDARD_7_0,
		},
		timeout: cdk.Duration.minutes(100),
		buildSpec: BuildSpec.fromObject({
			version: '0.2',
			phases: {
				install: {
					'runtime-versions': {
						ruby: '3.2',
					},
					commands: ['gem install cfn-nag'],
				},
				build: {
					commands: [
						'cd ./cdk-code',
						'find ./cdk.out -type f -name "*.template.json" | xargs -I{} cfn_nag_scan --deny-list-path cfn-nag-deny-list.yml --input-path {}',
					],
				},
			},
		}),
	});

	// Crear un CodeBuild para el Deploy Wave 1
	const deployWave1 = new PipelineProject(scope, 'CodeBuildProjectDeployWave1', {
		projectName: createName('codebuild', 'deploy-wave-1'),
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
					commands: ['node -v', 'sudo npm install -g aws-cdk'],
				},
				build: {
					commands: [
						'cd ./cdk-code',
						'npm install',
						`stacks=${
							props.env.environment === 'dev'
								? `$(awk 'NR>1 && /^$/ {exit} { printf "%s ", buf; buf = $0 } NR == 1 { buf = $0 } END { printf "%s", buf }' stack-to-deploy.txt)`
								: `$(awk '/^$/{flag=1; next} flag{printf "%s ", $0}' stack-to-deploy.txt)`
						}`,
						`cdk deploy $stacks --method=direct --require-approval never`,
					],
				},
			},
		}),
	});

	deployWave1.addToRolePolicy(
		new iam.PolicyStatement({
			actions: ['sts:AssumeRole'],
			resources: ['*'],
		})
	);

	const envId = createName('sm', 'env');
	const nameRepository = createName('ecr', 'repository');
	const dbCredentials = createName('aurora-mysql', 'password');
	const sesCredentials = createName('sm', 'smtp-credentials');
	// Crear un CodeBuild para Build
	const build = new PipelineProject(scope, 'CodeBuildProjectBuild', {
		projectName: createName('codebuild', 'build'),
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
					commands: ['node -v', 'npm install'],
				},
				build: {
					commands: [
						`ENV_TEMPLATE=$(aws secretsmanager get-secret-value --secret-id ${envId} --query SecretString --output text)`,
						'echo "$ENV_TEMPLATE" > .env',
						'sudo apt-get install jq',
						`SES_CREDENTIALS=$(aws secretsmanager get-secret-value --secret-id ${sesCredentials} --query SecretString --output text)`,
						'MAIL_USERNAME=$(echo $SES_CREDENTIALS | jq -r ".username")',
						'MAIL_PASSWORD=$(echo $SES_CREDENTIALS | jq -r ".password")',
						'echo "MAIL_USERNAME=$MAIL_USERNAME" >> .env',
						'echo "MAIL_PASSWORD=$MAIL_PASSWORD" >> .env',
						`DB_CREDENTIALS=$(aws secretsmanager get-secret-value --secret-id ${dbCredentials} --query SecretString --output text)`,
						'DB_CONNECTION=$(echo $DB_CREDENTIALS | jq -r ".engine")',
						'DB_HOST=$(echo $DB_CREDENTIALS | jq -r ".host")',
						'DB_PORT=$(echo $DB_CREDENTIALS | jq -r ".port")',
						'DB_DATABASE=$(echo $DB_CREDENTIALS | jq -r ".dbname")',
						'DB_USERNAME=$(echo $DB_CREDENTIALS | jq -r ".username")',
						'DB_PASSWORD=$(echo $DB_CREDENTIALS | jq -r ".password")',
						'echo "DB_CONNECTION=$DB_CONNECTION" >> .env',
						'echo "DB_HOST=$DB_HOST" >> .env',
						'echo "DB_PORT=$DB_PORT" >> .env',
						'echo "DB_DATABASE=$DB_DATABASE" >> .env',
						'echo "DB_USERNAME=$DB_USERNAME" >> .env',
						'echo "DB_PASSWORD=$DB_PASSWORD" >> .env',
						`aws ecr get-login-password --region ${props.env.region} | docker login --username AWS --password-stdin ${props.env.accountId}.dkr.ecr.${props.env.region}.amazonaws.com`,
						`docker build -t ${nameRepository} .`,
						`docker tag ${nameRepository}:latest ${props.env.accountId}.dkr.ecr.${props.env.region}.amazonaws.com/${nameRepository}:latest`,
						`docker push ${props.env.accountId}.dkr.ecr.${props.env.region}.amazonaws.com/${nameRepository}:latest`,
					],
				},
			},
		}),
	});

	build.addToRolePolicy(
		new iam.PolicyStatement({
			actions: ['sts:AssumeRole', 'secretsmanager:GetSecretValue', 'ecr:*'],
			effect: iam.Effect.ALLOW,
			resources: ['*'],
		})
	);

	const nameContainer = createName('ecs', 'container');
	const taskDefinitionFamily = createName('ecs', 'task');
	const nameGroupLogs = createName('cw', 'ecs-logs');
	const nameTaskExecutionRole = createName('iam', 'task-execution-role');
	const nameTaskRole = createName('iam', 'task-role');
	const nameCluster = createName('ecs', 'cluster');
	const nameService = createName('ecs', 'service');
	// Crear un CodeBuild para Deploy Wave 2
	const deployWave2 = new PipelineProject(scope, 'CodeBuildAppProjectDeployWave2', {
		projectName: createName('codebuild', 'deploy-wave-2'),
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
					commands: ['node -v', 'sudo npm install -g aws-cdk'],
				},
				build: {
					commands: [
						'cd ./cdk-code',
						'npm install',
						'cdk deploy --all --method=direct --require-approval never',
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
							"taskRoleArn": "arn:aws:iam::${props.env.accountId}:role/${nameTaskRole}",
							"executionRoleArn": "arn:aws:iam::${props.env.accountId}:role/${nameTaskExecutionRole}",
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
						`aws ecs wait services-stable --cluster ${nameCluster} --services ${nameService}`,
					],
				},
			},
		}),
	});

	// Conceder permisos al CodeBuild project de deploy
	deployWave2.addToRolePolicy(
		new iam.PolicyStatement({
			actions: [
				'sts:AssumeRole',
				'ecs:RegisterTaskDefinition',
				'ecs:UpdateService',
				'ecs:DescribeServices',
				'ecs:TagResource',
				'iam:PassRole',
			],
			resources: ['*'],
		})
	);

	return {
		linter,
		synth,
		unitTest,
		security,
		deployWave1,
		build,
		deployWave2,
	};
};
