import type { Felines } from 'animal-features';

export class Cat {
	constructor(
		public name: string,
		public eyes?: {
			left?: Felines.EyeColour;
			right?: Felines.EyeColour;
		},
		public fur?: Felines.FurColour,
	) {}
}
