import Yoga from 'yoga-layout-prebuilt';
import widestLine from 'widest-line';
import indentString from 'indent-string';
import sliceAnsi from 'slice-ansi';
import wrapText from './wrap-text';
import getMaxWidth from './get-max-width';
import squashTextNodes from './squash-text-nodes';
import renderBorder from './render-border';
import {DOMElement} from './dom';
import Output from './output';

// If parent container is `<Box>`, text nodes will be treated as separate nodes in
// the tree and will have their own coordinates in the layout.
// To ensure text nodes are aligned correctly, take X and Y of the first text node
// and use it as offset for the rest of the nodes
// Only first node is taken into account, because other text nodes can't have margin or padding,
// so their coordinates will be relative to the first node anyway
const applyPaddingToText = (node: DOMElement, text: string): string => {
	const yogaNode = node.childNodes[0]?.yogaNode;

	if (yogaNode) {
		const offsetX = yogaNode.getComputedLeft();
		const offsetY = yogaNode.getComputedTop();
		text = '\n'.repeat(offsetY) + indentString(text, offsetX);
	}

	return text;
};

const clipText = (
	text: string,
	maxWidth: number | undefined,
	maxHeight: number | undefined
): string => {
	let lines = text.split('\n');

	if (typeof maxWidth === 'number') {
		lines = lines.map(line => sliceAnsi(line, 0, maxWidth));
	}

	if (typeof maxHeight === 'number') {
		lines = lines.slice(0, maxHeight);
	}

	return lines.join('\n');
};

export type OutputTransformer = (s: string) => string;

// After nodes are laid out, render each to output object, which later gets rendered to terminal
const renderNodeToOutput = (
	node: DOMElement,
	output: Output,
	options: {
		offsetX?: number;
		offsetY?: number;
		overflowWidth?: number;
		overflowHeight?: number;
		transformers?: OutputTransformer[];
		skipStaticElements: boolean;
	}
) => {
	const {
		offsetX = 0,
		offsetY = 0,
		overflowWidth,
		overflowHeight,
		transformers = [],
		skipStaticElements
	} = options;

	if (skipStaticElements && node.internal_static) {
		return;
	}

	const {yogaNode} = node;

	if (yogaNode) {
		if (yogaNode.getDisplay() === Yoga.DISPLAY_NONE) {
			return;
		}

		// Left and top positions in Yoga are relative to their parent node
		const x = offsetX + yogaNode.getComputedLeft();
		const y = offsetY + yogaNode.getComputedTop();

		// Transformers are functions that transform final text output of each component
		// See Output class for logic that applies transformers
		let newTransformers = transformers;

		if (typeof node.internal_transform === 'function') {
			newTransformers = [node.internal_transform, ...transformers];
		}

		if (node.nodeName === 'ink-text') {
			let text = squashTextNodes(node);

			if (text.length > 0) {
				const currentWidth = widestLine(text);
				const maxWidth = getMaxWidth(yogaNode);

				if (currentWidth > maxWidth) {
					const textWrap = node.style.textWrap ?? 'wrap';
					text = wrapText(text, maxWidth, textWrap);
				}

				text = applyPaddingToText(node, text);

				if (
					typeof overflowWidth === 'number' ||
					typeof overflowHeight === 'number'
				) {
					text = clipText(text, overflowWidth, overflowHeight);
				}

				output.write(x, y, text, {transformers: newTransformers});
			}

			return;
		}

		let newOverflowWidth = overflowWidth;
		let newOverflowHeight = overflowHeight;

		if (node.nodeName === 'ink-box') {
			renderBorder(x, y, node, output);

			if (node.style.overflowX === 'hidden') {
				newOverflowWidth =
					yogaNode.getComputedWidth() -
					yogaNode.getComputedBorder(Yoga.EDGE_RIGHT) * 2;
			}

			if (node.style.overflowY === 'hidden') {
				newOverflowHeight =
					yogaNode.getComputedHeight() -
					yogaNode.getComputedBorder(Yoga.EDGE_BOTTOM) * 2;
			}
		}

		if (node.nodeName === 'ink-root' || node.nodeName === 'ink-box') {
			for (const childNode of node.childNodes) {
				renderNodeToOutput(childNode as DOMElement, output, {
					offsetX: x,
					offsetY: y,
					overflowWidth: newOverflowWidth,
					overflowHeight: newOverflowHeight,
					transformers: newTransformers,
					skipStaticElements
				});
			}
		}
	}
};

export default renderNodeToOutput;
