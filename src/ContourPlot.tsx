import { Interval, usePaneContext, vec } from 'mafs';
import { type JSX, useEffect, useMemo, useState } from 'react';

import { Mesh } from './plotter/Mesh';
import { Plotter } from './plotter/Plotter';
import { linearGradient } from './util/gradient';
import { useTransformPoint } from './util/useTransformPoint';
import { useScale } from './util/useScale';
import { subdivideCoords } from './util/subdivideCoords';

interface ContourPlotProps {
    f: (xy: vec.Vector2) => number;
    fRange: Interval;
}

export function ContourPlot(props: ContourPlotProps): JSX.Element {
    const { f, fRange } = props;

    const transformPoint = useTransformPoint();
    const { xPaneRange, yPaneRange, xPanes, yPanes } = usePaneContext();

    const canvasTopLeft = transformPoint([xPaneRange[0], yPaneRange[1]]);
    const canvasBottomRight = transformPoint([xPaneRange[1], yPaneRange[0]]);

    const [canvasX, canvasY] = canvasTopLeft;
    const [canvasWidth, canvasHeight] = vec.sub(
        canvasBottomRight,
        canvasTopLeft,
    );

    const [canvasElement, setCanvasElement] =
        useState<HTMLCanvasElement | null>(null);
    const [plotter, setPlotter] = useState<Plotter | null>(null);

    useEffect(() => {
        if (!canvasElement) {
            return;
        }
        const plotter = new Plotter(canvasElement);
        setPlotter(plotter);

        // TODO: Return clean-up function
    }, [canvasElement]);

    const xPaneCoords = useMemo(
        () => [xPanes[0][0], ...xPanes.map((pane) => pane[1])],
        [xPanes],
    );
    const yPaneCoords = useMemo(
        () => [yPanes[0][0], ...yPanes.map((pane) => pane[1])],
        [yPanes],
    );

    // Maximum number of pixels per subdivision
    const resolution = 10;
    const [scaleX, scaleY] = useScale();

    const xCoords = useMemo(
        () => subdivideCoords(xPaneCoords, resolution / scaleX),
        [xPaneCoords, resolution, scaleX],
    );
    const yCoords = useMemo(
        () => subdivideCoords(yPaneCoords, resolution / scaleY),
        [yPaneCoords, resolution, scaleY],
    );

    useEffect(() => {
        if (!plotter) {
            return;
        }

        const mesh = new Mesh(xCoords, yCoords, f);

        plotter.densityLayer.updateTransform(
            vec
                .matrixBuilder()
                .translate(-xPaneRange[0], -yPaneRange[0])
                .scale(
                    2.0 / (xPaneRange[1] - xPaneRange[0]),
                    2.0 / (yPaneRange[1] - yPaneRange[0]),
                )
                .translate(-1, -1)
                .get(),
        );
        plotter.densityLayer.updateValueRange(fRange);
        plotter.densityLayer.updateGradient(
            linearGradient(
                [
                    [0, '#f11d0e'],
                    [0.5, 'transparent'],
                    [1, '#58a6ff'],
                ],
                5,
            ),
            false,
        );

        plotter.draw(mesh);
    }, [
        plotter,
        f,
        fRange,
        canvasWidth,
        canvasHeight,
        xPaneRange,
        yPaneRange,
        xCoords,
        yCoords,
    ]);

    return (
        <foreignObject
            x={canvasX}
            y={canvasY}
            width={Math.round(canvasWidth)}
            height={Math.round(canvasHeight)}
        >
            <canvas
                ref={setCanvasElement}
                width={Math.round(canvasWidth)}
                height={Math.round(canvasHeight)}
            />
        </foreignObject>
    );
}
