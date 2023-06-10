import { Interval, usePaneContext, vec } from 'mafs';
import { type JSX, useEffect, useState } from 'react';

import type { Mesh, Triangle, Vertex } from './plotter/Mesh';
import { Plotter } from './plotter/Plotter';
import { linearGradient } from './util/gradient';
import { useTransformPoint } from './util/useTransformPoint';

interface ContourPlotProps {
    f: (xy: vec.Vector2) => number;
    fRange: Interval;
}

export function ContourPlot(props: ContourPlotProps): JSX.Element {
    const { f, fRange } = props;

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
    const [plotter, setPlotter] = useState<Plotter | null>(null);

    useEffect(() => {
        if (!canvasElement) {
            return;
        }
        const plotter = new Plotter(canvasElement);
        setPlotter(plotter);

        // TODO: Return clean-up function
    }, [canvasElement]);

    useEffect(() => {
        if (!plotter) {
            return;
        }

        const mesh: Mesh = {
            vertices: [],
            triangles: [],
        };

        function addTriangle(
            canvasPoints: [vec.Vector2, vec.Vector2, vec.Vector2],
        ) {
            const vertices = canvasPoints.map(([cx, cy]) => {
                const sx = cx / canvasWidth;
                const sy = (canvasHeight - cy) / canvasHeight;

                const x = xPaneRange[0] * (1 - sx) + xPaneRange[1] * sx;
                const y = yPaneRange[0] * (1 - sy) + yPaneRange[1] * sy;

                const value = f([x, y]);

                return [x, y, value] as Vertex;
            });

            const indices = [
                mesh.vertices.length,
                mesh.vertices.length + 1,
                mesh.vertices.length + 2,
            ] as Triangle;

            mesh.vertices.push(...vertices);
            mesh.triangles.push(indices);
        }

        const resolution = 10;
        for (let cx = 0; cx < canvasWidth; cx += resolution) {
            for (let cy = 0; cy < canvasHeight; cy += resolution) {
                addTriangle([
                    [cx, cy],
                    [cx + resolution, cy],
                    [cx, cy + resolution],
                ]);
                addTriangle([
                    [cx + resolution, cy + resolution],
                    [cx, cy + resolution],
                    [cx + resolution, cy],
                ]);
            }
        }

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
            linearGradient([
                [0, 'red'],
                [0.5, 'transparent'],
                [1, 'blue'],
            ]),
        );

        plotter.draw(mesh);
    }, [plotter, f, fRange, canvasWidth, canvasHeight, xPaneRange, yPaneRange]);

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
