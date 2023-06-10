import type { Meta, StoryObj } from '@storybook/react';

import { ContourPlot } from './ContourPlot';
import { Mafs, Coordinates } from 'mafs';

export default {
    component: ContourPlot,
} satisfies Meta<typeof ContourPlot>;

type Story = StoryObj<typeof ContourPlot>;

export const Default: Story = {
    args: {
        f: ([x, y]) => Math.cos(x) + Math.cos(y),
    },
    render: (props) => (
        <Mafs width={800} height={600} zoom>
            <Coordinates.Cartesian />
            <ContourPlot {...props} />
        </Mafs>
    ),
};
