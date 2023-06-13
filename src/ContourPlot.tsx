import { Interval, usePaneContext, vec } from 'mafs';
import { type JSX, useEffect, useMemo, useState } from 'react';

import { Mesh } from './plotter/Mesh';
import { Plotter } from './plotter/Plotter';
import { linearGradient } from './util/gradient';
import { useTransformPoint } from './util/useTransformPoint';
import { useScale } from './util/useScale';
import { subdivideCoords } from './util/subdivideCoords';
import { analyzeTriangle } from './plotter/isolines';

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
    const resolution = 100;
    const [scaleX, scaleY] = useScale();

    const xCoords = useMemo(
        () => subdivideCoords(xPaneCoords, resolution / scaleX),
        [xPaneCoords, resolution, scaleX],
    );
    const yCoords = useMemo(
        () => subdivideCoords(yPaneCoords, resolution / scaleY),
        [yPaneCoords, resolution, scaleY],
    );

    // Update uniforms
    useEffect(() => {
        const transformationMatrix = vec
            .matrixBuilder()
            .translate(-xPaneRange[0], -yPaneRange[0])
            .scale(
                2.0 / (xPaneRange[1] - xPaneRange[0]),
                2.0 / (yPaneRange[1] - yPaneRange[0]),
            )
            .translate(-1, -1)
            .get();

        plotter?.densityLayer.updateTransform(transformationMatrix);
        plotter?.contourLineLayer.updateTransform(transformationMatrix);

        plotter?.scheduleDraw();
    }, [plotter, xPaneRange, yPaneRange]);

    useEffect(() => {
        plotter?.densityLayer.updateValueRange(fRange);
        plotter?.densityLayer.updateGradient(
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

        plotter?.scheduleDraw();
    }, [plotter]);

    const mesh = useMemo(() => new Mesh(), []);

    useEffect(() => {
        if (!plotter) {
            return;
        }

        const isolineThresholds = [-6 / 5, -2 / 5, 2 / 5, 6 / 5];
        const minTotalError = 0.01;

        performance.mark('build mesh');
        mesh.init(xCoords, yCoords, f);
        performance.measure('build mesh', 'build mesh');

        performance.mark('refine mesh');
        mesh.refine(f, {
            minDegree: 1,
            maxDegree: 10,
            shouldRefineTriangle: (triangleVertices) => {
                for (let isolineThreshold of isolineThresholds) {
                    const isolinePiece = analyzeTriangle(
                        triangleVertices,
                        isolineThreshold,
                    );
                    if (!isolinePiece) {
                        continue;
                    }

                    // TODO: Use local gradient to determine the pixel error

                    const totalError =
                        Math.abs(
                            f([isolinePiece[0][0], isolinePiece[0][1]]) -
                                isolineThreshold,
                        ) +
                        Math.abs(
                            f([isolinePiece[1][0], isolinePiece[1][1]]) -
                                isolineThreshold,
                        );

                    if (totalError > minTotalError) {
                        return true;
                    }
                }

                return false;
            },
        });
        performance.measure('refine mesh', 'refine mesh');

        const vertexData = mesh.getVertexData();
        const indexData = mesh.getIndexData();
        plotter.densityLayer.updateMesh(vertexData, indexData);

        const isolineVertices: number[] = [];
        for (
            let triangleIdx = 0;
            triangleIdx < indexData.length / 3;
            ++triangleIdx
        ) {
            const triangleVertices = mesh.getTriangleVertices(triangleIdx);
            for (let isolineThreshold of isolineThresholds) {
                const isolinePiece = analyzeTriangle(
                    triangleVertices,
                    isolineThreshold,
                );
                if (isolinePiece) {
                    isolineVertices.push(
                        isolinePiece[0][0],
                        isolinePiece[0][1],
                        isolinePiece[1][0],
                        isolinePiece[1][1],
                    );
                }
            }
        }
        plotter.contourLineLayer.updateBuffer(
            new Float32Array(isolineVertices),
        );

        plotter.scheduleDraw();
    }, [plotter, mesh, f, xCoords, yCoords]);

    useEffect(() => {
        if (!plotter) {
            return;
        }

        plotter.scheduleDraw();
    }, [
        plotter,

        // Also redraw when canvas dimensions change
        canvasWidth,
        canvasHeight,
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
