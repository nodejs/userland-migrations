import type { Canines } from 'animal-features';

export class Dog {
	constructor(
		public name: string,
		public eyes?: {
			left?: Canines.EyeColour;
			right?: Canines.EyeColour;
		},
		public fur?: Canines.FurColour,
	) {}
}
