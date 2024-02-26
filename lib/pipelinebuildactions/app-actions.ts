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
		actionName: createName('codebuild', 'linting-action'),
		project: projects.linter,
		input: sourceArtifact,
	});

	// Artifact del Synth
	const nameBuildArtifactSynth = createName('artifact', 'build-synth');
	const buildArtifactSynth = new Artifact(nameBuildArtifactSynth);
	// CodeBuild action Synth
	const synth = new CodeBuildAction({
		actionName: createName('codebuild', 'synth-action'),
		project: projects.synth,
		input: sourceArtifact,
		outputs: [buildArtifactSynth],
	});

	// CodeBuild action Unit Test
	const unitTest = new CodeBuildAction({
		actionName: createName('codebuild', 'unit-test-action'),
		project: projects.unitTest,
		input: sourceArtifact,
	});

	// CodeBuild action Security
	const security = new CodeBuildAction({
		actionName: createName('codebuild', 'security-action'),
		project: projects.security,
		input: buildArtifactSynth,
	});

	// CodeBuild action Deploy
	const deployWave1 = new CodeBuildAction({
		actionName: createName('codebuild', 'deploy-wave-1-action'),
		project: projects.deployWave1,
		input: sourceArtifact,
	});

	// CodeBuild action Build
	const build = new CodeBuildAction({
		actionName: createName('codebuild', 'build-action'),
		project: projects.build,
		input: sourceArtifact,
	});

	// CodeBuild action Manual Approval Post Build
	const manualApproval = new ManualApprovalAction({
		actionName: createName('codebuild', 'manual-approval'),
		additionalInformation: `Aprueba este paso si:

		1. Desea desplegar el resto de stacks faltantes (en caso ya tenga su infraestructura desplegada no será necesario volver a desplegarlos).
		2. Desea crear una nueva revisión de la imagen (desplegar en los contenedores una nueva versión de la imagen de su proyecto).
		
		Para que no haya errores no olvide:

		1. Haber importado los certificados correctamente.
		2. Haber configurado el parameter store con los ARN de los certificados.`,
	});

	// CodeBuild action Deploy
	const deployWave2 = new CodeBuildAction({
		actionName: createName('codebuild', 'deploy-wave-2-action'),
		project: projects.deployWave2,
		input: sourceArtifact,
	});

	return {
		source,
		linting,
		synth,
		unitTest,
		security,
		deployWave1,
		build,
		manualApproval,
		deployWave2,
	};
};
