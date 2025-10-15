import type { InvokeOptions } from '../utils/router.js';

export type TfTrainInput = {
  config: {
    layers: { units: number; activation?: string }[];
    epochs?: number;
    batchSize?: number;
    learningRate?: number;
  };
  dataset: {
    // For demo: simple numeric arrays X, y
    x: number[][];
    y: number[][];
    validationSplit?: number;
  };
};

export async function invoke(args: unknown, options?: InvokeOptions) {
  const input = args as TfTrainInput;
  const { layers, epochs = 5, batchSize = 32, learningRate = 0.001 } = input.config;
  const { x, y, validationSplit = 0.1 } = input.dataset;

  const tfmod = await import('@tensorflow/tfjs-node');
  const tf: any = tfmod;
  const model = tf.sequential();

  for (let i = 0; i < layers.length; i++) {
    const l = layers[i];
    const activation = (l.activation || 'relu');
    model.add(tf.layers.dense({ units: l.units, activation, inputShape: i === 0 ? [x[0].length] : undefined }));
  }
  model.add(tf.layers.dense({ units: y[0].length, activation: 'linear' }));

  const optimizer = tf.train.adam(learningRate);
  model.compile({ optimizer, loss: 'meanSquaredError', metrics: ['mse'] });

  const xs = tf.tensor2d(x);
  const ys = tf.tensor2d(y);

  const id = `${Date.now()}`;

  const history = await model.fit(xs, ys, {
    epochs,
    batchSize,
    validationSplit,
    callbacks: {
      onEpochEnd: async (epoch: number, logs?: any) => {
        if (options?.stream && options.sseSource) {
          options.sseSource.write({ event: 'chunk', data: JSON.stringify({ id, provider: 'tf', model: 'dense', delta: JSON.stringify({ epoch, ...logs }) }) });
        }
      },
    },
  });

  const finalMetrics = history.history;
  const result = { summary: { epochs, batchSize }, metrics: finalMetrics };
  return result;
}
