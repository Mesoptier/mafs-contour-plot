import { Interval, usePaneContext, vec } from 'mafs';
import { type JSX, useLayoutEffect, useState } from 'react';

import { useTransformPoint } from './util/useTransformPoint';

interface ContourPlotProps {
    f: (xy: vec.Vector2) => number;
}

export function ContourPlot(props: ContourPlotProps): JSX.Element {
    const { f } = props;

    const transformPoint = useTransformPoint();
    const { xPaneRange, yPaneRange } = usePaneContext();

    const canvasTopLeft = transformPoint([xPaneRange[0], yPaneRange[1]]);
    const canvasBottomRight = transformPoint([xPaneRange[1], yPaneRange[0]]);

    const [canvasX, canvasY] = canvasTopLeft;
    const [canvasWidth, canvasHeight] = vec.sub(
        canvasBottomRight,
        canvasTopLeft,
    );

    const [canvasElement, setCanvasElement] =
        useState<HTMLCanvasElement | null>(null);

    useLayoutEffect(() => {
        const ctx = canvasElement?.getContext('2d');
        if (!ctx) {
            return;
        }

        ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        const resolution = 5;
        const zRange = [-2, 2] as Interval;

        for (let cx = 0; cx < canvasWidth; cx += resolution) {
            for (let cy = 0; cy < canvasHeight; cy += resolution) {
                const sx = cx / canvasWidth;
                const sy = cy / canvasHeight;

                const x = xPaneRange[0] * (1 - sx) + xPaneRange[1] * sx;
                const y = yPaneRange[1] * (1 - sy) + yPaneRange[0] * sy;

                const z = (f([x, y]) - zRange[0]) / (zRange[1] - zRange[0]);
                ctx.fillStyle = `rgba(255, 0, 0, ${z})`;
                ctx.fillRect(cx, cy, resolution, resolution);
            }
        }
    }, [f, xPaneRange, yPaneRange, canvasWidth, canvasHeight, canvasElement]);

    return (
        <foreignObject
            x={canvasX}
            y={canvasY}
            width={canvasWidth}
            height={canvasHeight}
        >
            <canvas
                ref={setCanvasElement}
                width={canvasWidth}
                height={canvasHeight}
            />
        </foreignObject>
    );
}
