import sliceAnsi from 'slice-ansi';
import stringWidth from 'string-width';
import widestLine from 'widest-line';
import {OutputTransformer} from './render-node-to-output';

/**
 * "Virtual" output class
 *
 * Handles the positioning and saving of the output of each node in the tree.
 * Also responsible for applying transformations to each character of the output.
 *
 * Used to generate the final output of all nodes before writing it to actual output stream (e.g. stdout)
 */

interface Options {
	width: number;
	height: number;
}

type Operation =
	| WriteOperation
	| ClipHorizontallyOperation
	| ClipVerticallyOperation
	| ResetClippingOperation;

interface WriteOperation {
	type: 'write';
	x: number;
	y: number;
	text: string;
	transformers: OutputTransformer[];
}

interface ClipHorizontallyOperation {
	type: 'clip-horizontally';
	x1: number;
	x2: number;
}

interface ClipVerticallyOperation {
	type: 'clip-vertically';
	y1: number;
	y2: number;
}

interface ResetClippingOperation {
	type: 'reset-clipping';
}

export default class Output {
	width: number;
	height: number;

	private readonly operations: Operation[] = [];

	constructor(options: Options) {
		const {width, height} = options;

		this.width = width;
		this.height = height;
	}

	write(
		x: number,
		y: number,
		text: string,
		options: {transformers: OutputTransformer[]}
	): void {
		const {transformers} = options;

		if (!text) {
			return;
		}

		this.operations.push({
			type: 'write',
			x,
			y,
			text,
			transformers
		});
	}

	clipHorizontally(x1: number, x2: number) {
		this.operations.push({
			type: 'clip-horizontally',
			x1,
			x2
		});
	}

	clipVertically(y1: number, y2: number) {
		this.operations.push({
			type: 'clip-vertically',
			y1,
			y2
		});
	}

	resetClipping() {
		this.operations.push({
			type: 'reset-clipping'
		});
	}

	get(): {output: string; height: number} {
		// Initialize output array with a specific set of rows, so that margin/padding at the bottom is preserved
		const output: string[] = [];

		for (let y = 0; y < this.height; y++) {
			output.push(' '.repeat(this.width));
		}

		let clipX1: number | undefined;
		let clipX2: number | undefined;
		let clipY1: number | undefined;
		let clipY2: number | undefined;

		for (const operation of this.operations) {
			if (operation.type === 'clip-horizontally') {
				clipX1 = operation.x1;
				clipX2 = operation.x2;
			}

			if (operation.type === 'clip-vertically') {
				clipY1 = operation.y1;
				clipY2 = operation.y2;
			}

			if (operation.type === 'reset-clipping') {
				clipX1 = undefined;
				clipX2 = undefined;
				clipY1 = undefined;
				clipY2 = undefined;
			}

			if (operation.type === 'write') {
				const {text, transformers} = operation;
				let {x, y} = operation;
				let lines = text.split('\n');

				// If text is positioned outside of clipping area altogether,
				// skip to the next operation to avoid unnecessary calculations
				if (typeof clipX1 === 'number' && typeof clipX2 === 'number') {
					const width = widestLine(text);

					if (x + width < clipX1 || x > clipX2) {
						continue;
					}
				}

				if (typeof clipY1 === 'number' && typeof clipY2 === 'number') {
					const height = lines.length;

					if (y + height < clipY1 || y > clipY2) {
						continue;
					}
				}

				if (typeof clipX1 === 'number' && typeof clipX2 === 'number') {
					lines = lines.map(line => {
						const from = x < clipX1! ? clipX1! - x : 0;
						const width = stringWidth(line);
						const to = x + width > clipX2! ? clipX2! - x : width;

						return sliceAnsi(line, from, to);
					});

					if (x < clipX1) {
						x = clipX1;
					}
				}

				if (typeof clipY1 === 'number' && typeof clipY2 === 'number') {
					const from = y < clipY1 ? clipY1 - y : 0;
					const height = lines.length;
					const to = y + height > clipY2 ? clipY2 - y : height;

					lines = lines.slice(from, to);

					if (y < clipY1) {
						y = clipY1;
					}
				}

				let offsetY = 0;

				for (let line of lines) {
					const currentLine = output[y + offsetY];

					// Line can be missing if `text` is taller than height of pre-initialized `this.output`
					if (!currentLine) {
						continue;
					}

					const width = stringWidth(line);

					for (const transformer of transformers) {
						line = transformer(line);
					}

					output[y + offsetY] =
						sliceAnsi(currentLine, 0, x) +
						line +
						sliceAnsi(currentLine, x + width);

					offsetY++;
				}
			}
		}

		// eslint-disable-next-line unicorn/prefer-trim-start-end
		const generatedOutput = output.map(line => line.trimRight()).join('\n');

		return {
			output: generatedOutput,
			height: output.length
		};
	}
}
