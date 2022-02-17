import React from 'react';
import test from 'ava';
import boxen, {Options} from 'boxen';
import {renderToString} from './helpers/render-to-string';
import {Box, Text} from '../src';

const box = (text: string, options?: Options): string => {
	return boxen(text, {
		...options,
		borderStyle: 'round'
	});
};

test('hide horizontal overflow', t => {
	const output = renderToString(
		<Box width={6} overflowX="hidden">
			<Box width={12} flexShrink={0}>
				<Text>Hello World</Text>
			</Box>
		</Box>
	);

	t.is(output, 'Hello');
});

test('hide horizontal overflow with border', t => {
	const output = renderToString(
		<Box width={6} overflowX="hidden" borderStyle="round">
			<Box width={12} flexShrink={0}>
				<Text>Hello World</Text>
			</Box>
		</Box>
	);

	t.is(output, box('Hell'));
});

test('show horizontal overflow with border', t => {
	const output = renderToString(
		<Box width={6} overflowX="visible" borderStyle="round">
			<Box width={12} flexShrink={0}>
				<Text>Hello World</Text>
			</Box>
		</Box>
	);

	const lines = box('Hell').split('\n');
	lines[1] = lines[1][0] + 'Hello World';

	t.is(output, lines.join('\n'));
});

test('hide vertical overflow', t => {
	const output = renderToString(
		<Box height={1} overflowY="hidden">
			<Text>Hello{'\n'}World</Text>
		</Box>
	);

	t.is(output, 'Hello');
});

test('show vertical overflow', t => {
	const output = renderToString(
		<Box height={2}>
			<Box height={1} overflowY="visible">
				<Box height={2}>
					<Text>Hello{'\n'}World</Text>
				</Box>
			</Box>
		</Box>
	);

	t.is(output, 'Hello\nWorld');
});

test('hide vertical overflow with border', t => {
	const output = renderToString(
		<Box width={20} height={3} overflowY="hidden" borderStyle="round">
			<Text>Hello{'\n'}World</Text>
		</Box>
	);

	t.is(output, box('Hello'.padEnd(18, ' ')));
});

test('show vertical overflow with border', t => {
	const output = renderToString(
		<Box height={3}>
			<Box width={20} height={3} overflowY="visible" borderStyle="round">
				<Box height={2}>
					<Text>Hello{'\n'}World</Text>
				</Box>
			</Box>
		</Box>
	);

	const lines = box('Test'.padEnd(18, ' ')).split('\n');
	lines[1] = lines[1][0] + 'Hello'.padEnd(18, ' ') + lines[1][19];
	lines[2] =
		lines[2][0] +
		'World' +
		lines[0][1].repeat(18 - 'World'.length) +
		lines[2][19];

	t.is(output, lines.join('\n'));
});
