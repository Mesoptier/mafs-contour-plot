import type { Meta, StoryObj } from '@storybook/react';
import { Coordinates, Mafs, useMovablePoint, type vec } from 'mafs';
import { useCallback } from 'react';

import { ContourPlot } from './ContourPlot';

export default {
    component: ContourPlot,
} satisfies Meta<typeof ContourPlot>;

type Story = StoryObj<typeof ContourPlot>;

export const Default: Story = {
    args: {
        fRange: [-2, 2],
    },
    render: (props) => {
        const scale = useMovablePoint([1, 1]);
        const f = useCallback(
            (xy: vec.Vector2) =>
                Math.cos(xy[0] / scale.point[0] + xy[1] ** 2) +
                Math.cos(xy[1] / scale.point[1]),
            [scale.point],
        );

        return (
            <Mafs width={800} height={600} zoom>
                <Coordinates.Cartesian />
                <ContourPlot {...props} f={f} />
                {scale.element}
            </Mafs>
        );
    },
};
