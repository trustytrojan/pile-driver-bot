import fs from 'node:fs';

type RhodesAPIOperator = {
	name: string;
	art: {
		name: string;
		link: string;
	}[];
	// other stuff not here...
};

export let operators: NodeJS.Dict<RhodesAPIOperator> = {};
if (!fs.existsSync('operators.json')) {
	const operatorsData: RhodesAPIOperator[] = await fetch('https://api.rhodesapi.com/api/operator').then(r =>
		r.json()
	);
	for (const operatorData of operatorsData) {
		operators[operatorData.name.toLowerCase()] = operatorData;
	}
	fs.writeFileSync('operators.json', JSON.stringify(operators, null, '\t'));
} else {
	operators = JSON.parse(fs.readFileSync('operators.json').toString());
}

export const operatorNames = Object.keys(operators);
