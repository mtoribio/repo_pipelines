import { Artifact } from 'aws-cdk-lib/aws-codepipeline';
import {
	CodeStarConnectionsSourceAction,
	CodeBuildAction,
	ManualApprovalAction,
} from 'aws-cdk-lib/aws-codepipeline-actions';
import { infraBuildProjects } from '../pipelinebuildprojects/infra-projects';
import { createName } from '../../utils/createName';
import { Construct } from 'constructs';
import * as ssm from 'aws-cdk-lib/aws-ssm';

export interface InfraBuildActionsProps {
	env: {
		region: string;
		project: string;
		environment: string;
		ownerAccount: string;
		infraRepo: string;
		infraBranch: string;
	};
}

export const infraBuildActions = (scope: Construct, props: InfraBuildActionsProps) => {
	// Crear los build projects
	const projects = infraBuildProjects(scope);

	// Conectar al repositorio en Github
	const nameParameter = createName('ps', 'conn-arn');
	const connectionArn = ssm.StringParameter.fromStringParameterName(scope, 'ConnARN', nameParameter).stringValue;

	// Artifact del Source
	const nameSourceArtifact = createName('artifact', 'infra-source');
	const sourceArtifact = new Artifact(nameSourceArtifact);
	// CodeStarConnections action
	const source = new CodeStarConnectionsSourceAction({
		actionName: createName('codepipeline', 'infra-github-conn'),
		owner: props.env.ownerAccount,
		repo: props.env.infraRepo,
		output: sourceArtifact,
		branch: props.env.infraBranch,
		triggerOnPush: true,
		connectionArn,
	});

	// CodeBuild action Linting
	const linting = new CodeBuildAction({
		actionName: createName('codebuild', 'infra-linting-action'),
		project: projects.linter,
		input: sourceArtifact,
	});

	// Artifact del Synth
	const nameBuildArtifactSynth = createName('artifact', 'infra-build-synth');
	const buildArtifactSynth = new Artifact(nameBuildArtifactSynth);
	// CodeBuild action Synth
	const synth = new CodeBuildAction({
		actionName: createName('codebuild', 'infra-synth-action'),
		project: projects.synth,
		input: sourceArtifact,
		outputs: [buildArtifactSynth],
	});

	// CodeBuild action Unit Test
	const unitTest = new CodeBuildAction({
		actionName: createName('codebuild', 'infra-unit-test-action'),
		project: projects.unitTest,
		input: sourceArtifact,
	});

	// CodeBuild action Security
	const security = new CodeBuildAction({
		actionName: createName('codebuild', 'infra-security-action'),
		project: projects.security,
		input: buildArtifactSynth,
	});

	// CodeBuild action PreDeploy
	const preDeploy = new CodeBuildAction({
		actionName: createName('codebuild', 'infra-predeploy-action'),
		project: projects.preDeploy,
		input: buildArtifactSynth,
	});

	// CodeBuild action Manual Approval
	const manualApproval = new ManualApprovalAction({
		actionName: createName('codebuild', 'infra-manual-approval'),
		additionalInformation: `Aprueba este paso si:

			1. Se ha importado los certificados en AWS ACM (N. Virginia y Ohio) y almacenado los ARN de los certificados en Parameter Store de AWS Systems Manager (manual, solo se realiza la primera vez que se construye la infraestructura, en caso contrario omitir).
			2. Se ha subido una imagen al respositorio.`,
	});

	// CodeBuild action Deploy
	const deploy = new CodeBuildAction({
		actionName: createName('codebuild', 'infra-deploy-action'),
		project: projects.deploy,
		input: buildArtifactSynth,
	});

	return {
		source,
		linting,
		synth,
		unitTest,
		security,
		preDeploy,
		manualApproval,
		deploy,
	};
};
