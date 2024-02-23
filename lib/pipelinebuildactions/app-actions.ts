import { Artifact } from 'aws-cdk-lib/aws-codepipeline';
import {
	CodeStarConnectionsSourceAction,
	CodeBuildAction,
	ManualApprovalAction,
} from 'aws-cdk-lib/aws-codepipeline-actions';
import { appBuildProjects } from '../pipelinebuildprojects/app-projects';
import { createName } from '../../utils/createName';
import { Construct } from 'constructs';
import * as ssm from 'aws-cdk-lib/aws-ssm';

export interface AppBuildActionsProps {
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

export const appBuildActions = (scope: Construct, props: AppBuildActionsProps) => {
	// Crear los build projects
	const projects = appBuildProjects(scope, props);

	// Conectar al repositorio en Github
	const nameParameter = createName('ps', 'conn-arn');
	const connectionArn = ssm.StringParameter.fromStringParameterName(scope, 'ConnARN', nameParameter).stringValue;

	// Artifact del Source
	const nameSourceArtifact = createName('artifact', 'app-source');
	const sourceArtifact = new Artifact(nameSourceArtifact);
	// CodeStarConnections action
	const source = new CodeStarConnectionsSourceAction({
		actionName: createName('codepipeline', 'app-github-conn'),
		owner: props.env.ownerAccount,
		repo: props.env.appRepo,
		output: sourceArtifact,
		branch: props.env.appBranch,
		triggerOnPush: true,
		connectionArn,
	});

	// CodeBuild action Linting
	const linting = new CodeBuildAction({
		actionName: createName('codebuild', 'app-linting-action'),
		project: projects.linter,
		input: sourceArtifact,
	});

	// CodeBuild action Unit Test
	const unitTest = new CodeBuildAction({
		actionName: createName('codebuild', 'app-unit-test-action'),
		project: projects.unitTest,
		input: sourceArtifact,
	});

	// CodeBuild action Security
	const security = new CodeBuildAction({
		actionName: createName('codebuild', 'app-security-action'),
		project: projects.security,
		input: sourceArtifact,
	});

	// CodeBuild action Manual Approval Pre Build
	const manualApprovalPreBuild = new ManualApprovalAction({
		actionName: createName('codebuild', 'app-manual-approval-prebuild'),
		additionalInformation: `Aprueba este paso si:

		1. Se han creado los stacks: repository, database, email y sandbox (automático al iniciar el pipeline de la infraestructura).
		2. Se ha configurado el .env en AWS Secrets Manager (manual, se configura una vez y en caso sea necesario).
		3. Se ha ejecutado los comandos: php artisan migrate y php artisan db:seed en la sandbox (manual, solo se realiza la primera vez que se construye la app, en caso contrario omitir).`,
	});

	// Artifact del Build
	const nameBuildArtifactBuild = createName('artifact', 'app-build');
	const buildArtifactBuild = new Artifact(nameBuildArtifactBuild);
	// CodeBuild action Build
	const build = new CodeBuildAction({
		actionName: createName('codebuild', 'app-build-action'),
		project: projects.build,
		input: sourceArtifact,
		outputs: [buildArtifactBuild],
	});

	// CodeBuild action Manual Approval Post Build
	const manualApprovalPreDeploy = new ManualApprovalAction({
		actionName: createName('codebuild', 'app-manual-approval-postbuild'),
		additionalInformation: `Aprueba este paso si:

		1. Se ha desplegado el stack de los contenedores.`,
	});

	// CodeBuild action Deploy
	const deploy = new CodeBuildAction({
		actionName: createName('codebuild', 'app-deploy-action'),
		project: projects.deploy,
		input: buildArtifactBuild,
	});

	return {
		source,
		linting,
		unitTest,
		security,
		manualApprovalPreBuild,
		build,
		manualApprovalPreDeploy,
		deploy,
	};
};
