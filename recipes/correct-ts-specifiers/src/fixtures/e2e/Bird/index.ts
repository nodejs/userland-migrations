import type { Avians } from 'animal-features';

export class Bird {
	constructor(
		public name: string,
		public eyes?: {
			left?: Avians.EyeColour;
			right?: Avians.EyeColour;
		},
		public feathers?: Avians.FeatherColour | Avians.FeatherColour[],
	) {}
}
