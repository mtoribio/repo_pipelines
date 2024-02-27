interface Environment {
	region: string;
	project: string;
	environment: string;
	ownerAccount: string;
	appRepo: string;
	appBranch: string;
	accountId: string;
}

export const environments: { [key: string]: Environment } = {
	dev: {
		region: 'us-east-2',
		project: 'hrmgo',
		environment: 'dev',
		ownerAccount: 'mtoribio',
		appRepo: 'repo_app',
		appBranch: 'development',
		accountId: '884162918988',
	},

	prod: {
		region: 'us-east-2',
		project: 'hrmgo',
		environment: 'prod',
		ownerAccount: 'overalldev',
		appRepo: 'NewHRMv2.0',
		appBranch: 'main',
		accountId: '364964202465',
	},
};
