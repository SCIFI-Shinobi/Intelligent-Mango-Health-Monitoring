/*
 * MangoGuard unified library — Forecasting model metadata
 * Auto-adapted from forcasting_inferencing model_metadata.h (project 916176, deploy v5).
 * All EI_CLASSIFIER_* defines are prefixed MG_FORECAST_* to avoid conflicts.
 *
 * Original Copyright (c) 2026 EdgeImpulse Inc.  (Apache-2.0 / EdgeImpulse Terms)
 */

#ifndef _MG_FORECAST_MODEL_METADATA_H_
#define _MG_FORECAST_MODEL_METADATA_H_

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

/* Shared enum constants are defined in model_metadata_health.h — include it first */
#include "model-parameters-health/model_metadata_health.h"

/* ── Forecast-model-specific constants (MG_FORECAST_ namespace) ── */

#define MG_FORECAST_PROJECT_ID                   916176
#define MG_FORECAST_PROJECT_NAME                 "forcasting"
#define MG_FORECAST_DEPLOY_VERSION               5

/* Input / DSP geometry */
#define MG_FORECAST_NN_INPUT_FRAME_SIZE          48
#define MG_FORECAST_RAW_SAMPLE_COUNT             24
#define MG_FORECAST_RAW_SAMPLES_PER_FRAME        2
#define MG_FORECAST_DSP_INPUT_FRAME_SIZE         (MG_FORECAST_RAW_SAMPLE_COUNT * MG_FORECAST_RAW_SAMPLES_PER_FRAME)
#define MG_FORECAST_INPUT_WIDTH                  0
#define MG_FORECAST_INPUT_HEIGHT                 0
#define MG_FORECAST_RESIZE_MODE                  EI_CLASSIFIER_RESIZE_NONE
#define MG_FORECAST_INPUT_FRAMES                 0
#define MG_FORECAST_INTERVAL_MS                  3600000
#define MG_FORECAST_FREQUENCY                    0.0002777777777777778

/* Output / labels */
#define MG_FORECAST_NN_OUTPUT_COUNT              3
#define MG_FORECAST_LABEL_COUNT                  3
#define MG_FORECAST_SINGLE_FEATURE_INPUT         1

/* Sensor — fusion of temperature + humidity */
#define MG_FORECAST_SENSOR                       EI_CLASSIFIER_SENSOR_FUSION
#define MG_FORECAST_FUSION_AXES_STRING           "temperature + humidity"

/* Anomaly */
#define MG_FORECAST_HAS_ANOMALY                  EI_ANOMALY_TYPE_UNKNOWN

/* TFLite engine */
#define MG_FORECAST_TFLITE_INPUT_DATATYPE        EI_CLASSIFIER_DATATYPE_FLOAT32
#define MG_FORECAST_TFLITE_OUTPUT_DATATYPE       EI_CLASSIFIER_DATATYPE_FLOAT32
#define MG_FORECAST_THRESHOLD                    0.6
#define MG_FORECAST_TFLITE_OUTPUT_DATA_TENSOR    0
#define MG_FORECAST_OBJECT_DETECTION_LAST_LAYER  EI_CLASSIFIER_LAST_LAYER_UNKNOWN
#define MG_FORECAST_INFERENCING_ENGINE           EI_CLASSIFIER_TFLITE
#define MG_FORECAST_COMPILED                     1
#define MG_FORECAST_QUANTIZATION_ENABLED         0
#define MG_FORECAST_HAS_DATA_NORMALIZATION       1
#define MG_FORECAST_TFLITE_LARGEST_ARENA_SIZE    2617
#define MG_FORECAST_HAS_TFLITE_OPS_RESOLVER      0

/* Feature flags */
#define MG_FORECAST_HAS_FFT_INFO                 1
#define MG_FORECAST_LOAD_FFT_32                  0
#define MG_FORECAST_LOAD_FFT_64                  0
#define MG_FORECAST_LOAD_FFT_128                 0
#define MG_FORECAST_LOAD_FFT_256                 0
#define MG_FORECAST_LOAD_FFT_512                 0
#define MG_FORECAST_LOAD_FFT_1024                0
#define MG_FORECAST_LOAD_FFT_2048                0
#define MG_FORECAST_LOAD_FFT_4096                0
#define MG_FORECAST_NON_STANDARD_FFT_SIZES       0
#define MG_FORECAST_HAS_VISUAL_ANOMALY           0
#define MG_FORECAST_HAS_MODEL_VARIABLES          1
#define MG_FORECAST_CALIBRATION_ENABLED          0
#define MG_FORECAST_OBJECT_TRACKING_ENABLED      0
#define MG_FORECAST_LOAD_IMAGE_SCALING           0
#define MG_FORECAST_DSP_AXES_INDEX_TYPE          uint8_t
#define MG_FORECAST_HR_ENABLED                   0
#define MG_FORECAST_EEG_ENABLED                  0
#define MG_FORECAST_OBJECT_DETECTION             0
#define MG_FORECAST_FREEFORM_OUTPUT              0
#define MG_FORECAST_HAS_ANOMALY_KMEANS           0
#define MG_FORECAST_HAS_ANOMALY_GMM              0
#define MG_FORECAST_HAS_ANOMALY_VISUAL_GMM       0
#define MG_FORECAST_HAS_ANOMALY_VISUAL_PATCHCORE 0
#define MG_FORECAST_HAS_ANOMALY_VISUAL_CUSTOM    0
#define MG_FORECAST_HAS_ANOMALY_CUSTOM           0
#define MG_FORECAST_LOAD_ANOMALY_H               0
#define MG_FORECAST_SLICES_PER_MODEL_WINDOW      4
#define MG_FORECAST_SLICE_SIZE                   (MG_FORECAST_RAW_SAMPLE_COUNT / MG_FORECAST_SLICES_PER_MODEL_WINDOW)

#endif /* _MG_FORECAST_MODEL_METADATA_H_ */
