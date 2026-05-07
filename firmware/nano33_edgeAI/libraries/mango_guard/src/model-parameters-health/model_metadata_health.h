/*
 * MangoGuard unified library — Health model metadata
 * Auto-adapted from mango_health_inferencing model_metadata.h (project 908354, deploy v8).
 * All EI_CLASSIFIER_* defines are prefixed MG_HEALTH_* to avoid conflicts with
 * the forecasting model's defines that live in model_metadata_forecast.h.
 *
 * Original Copyright (c) 2026 EdgeImpulse Inc.  (Apache-2.0 / EdgeImpulse Terms)
 */

#ifndef _MG_HEALTH_MODEL_METADATA_H_
#define _MG_HEALTH_MODEL_METADATA_H_

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

/* ── Shared enum constants (identical in both models, defined once here) ── */
#ifndef EI_CLASSIFIER_NONE
#define EI_CLASSIFIER_NONE                       255
#define EI_CLASSIFIER_UTENSOR                    1
#define EI_CLASSIFIER_TFLITE                     2
#define EI_CLASSIFIER_CUBEAI                     3
#define EI_CLASSIFIER_TFLITE_FULL                4
#define EI_CLASSIFIER_TENSAIFLOW                 5
#define EI_CLASSIFIER_TENSORRT                   6
#define EI_CLASSIFIER_DRPAI                      7
#define EI_CLASSIFIER_TFLITE_TIDL                8
#define EI_CLASSIFIER_AKIDA                      9
#define EI_CLASSIFIER_SYNTIANT                   10
#define EI_CLASSIFIER_ONNX_TIDL                  11
#define EI_CLASSIFIER_MEMRYX                     12
#define EI_CLASSIFIER_ETHOS_LINUX                13
#define EI_CLASSIFIER_ATON                       14
#define EI_CLASSIFIER_CEVA_NPN                   15
#define EI_CLASSIFIER_NORDIC_AXON                16
#define EI_CLASSIFIER_VLM_CONNECTOR              17

#define EI_CLASSIFIER_SENSOR_UNKNOWN             255
#define EI_CLASSIFIER_SENSOR_MICROPHONE          1
#define EI_CLASSIFIER_SENSOR_ACCELEROMETER       2
#define EI_CLASSIFIER_SENSOR_CAMERA              3
#define EI_CLASSIFIER_SENSOR_9DOF                4
#define EI_CLASSIFIER_SENSOR_ENVIRONMENTAL       5
#define EI_CLASSIFIER_SENSOR_FUSION              6

#define EI_ANOMALY_TYPE_UNKNOWN                  0
#define EI_ANOMALY_TYPE_KMEANS                   1
#define EI_ANOMALY_TYPE_GMM                      2
#define EI_ANOMALY_TYPE_VISUAL_GMM               3
#define EI_ANOMALY_TYPE_VISUAL_PATCHCORE         4
#define EI_ANOMALY_TYPE_CUSTOM                   5
#define EI_ANOMALY_TYPE_VISUAL_CUSTOM            6

#define EI_CLASSIFIER_DATATYPE_FLOAT32           1
#define EI_CLASSIFIER_DATATYPE_UINT8             3
#define EI_CLASSIFIER_DATATYPE_INT8              9

#define EI_CLASSIFIER_RESIZE_NONE                0
#define EI_CLASSIFIER_RESIZE_FIT_SHORTEST        1
#define EI_CLASSIFIER_RESIZE_FIT_LONGEST         2
#define EI_CLASSIFIER_RESIZE_SQUASH              3

#define EI_CLASSIFIER_LAST_LAYER_UNKNOWN         -1
#define EI_CLASSIFIER_LAST_LAYER_SSD             1
#define EI_CLASSIFIER_LAST_LAYER_FOMO            2
#define EI_CLASSIFIER_LAST_LAYER_YOLOV5          3
#define EI_CLASSIFIER_LAST_LAYER_YOLOX           4
#define EI_CLASSIFIER_LAST_LAYER_YOLOV5_V5_DRPAI 5
#define EI_CLASSIFIER_LAST_LAYER_YOLOV7          6
#define EI_CLASSIFIER_LAST_LAYER_TAO_RETINANET   7
#define EI_CLASSIFIER_LAST_LAYER_TAO_SSD         8
#define EI_CLASSIFIER_LAST_LAYER_TAO_YOLOV3      9
#define EI_CLASSIFIER_LAST_LAYER_TAO_YOLOV4      10

#define EI_CLASSIFIER_IMAGE_SCALING_NONE         0
#define EI_CLASSIFIER_IMAGE_SCALING_0_255        1
#define EI_CLASSIFIER_IMAGE_SCALING_TORCH        2
#define EI_CLASSIFIER_IMAGE_SCALING_MIN1_1       3

#define EI_CLASSIFIER_TYPE_CLASSIFICATION        1
#define EI_CLASSIFIER_TYPE_OBJECT_DETECTION      2
#define EI_CLASSIFIER_TYPE_REGRESSION            3
#define EI_CLASSIFIER_MODE_CLASSIFICATION        EI_CLASSIFIER_TYPE_CLASSIFICATION
#define EI_CLASSIFIER_MODE_OBJECT_DETECTION      EI_CLASSIFIER_TYPE_OBJECT_DETECTION
#define EI_CLASSIFIER_MODE_REGRESSION            EI_CLASSIFIER_TYPE_REGRESSION
#endif /* EI_CLASSIFIER_NONE */

/* ── Health-model-specific constants (MG_HEALTH_ namespace) ── */

#define MG_HEALTH_PROJECT_ID                     908354
#define MG_HEALTH_PROJECT_NAME                   "mango health"
#define MG_HEALTH_DEPLOY_VERSION                 8

/* Input / DSP geometry */
#define MG_HEALTH_NN_INPUT_FRAME_SIZE            27648
#define MG_HEALTH_RAW_SAMPLE_COUNT               9216
#define MG_HEALTH_RAW_SAMPLES_PER_FRAME          1
#define MG_HEALTH_DSP_INPUT_FRAME_SIZE           (MG_HEALTH_RAW_SAMPLE_COUNT * MG_HEALTH_RAW_SAMPLES_PER_FRAME)
#define MG_HEALTH_INPUT_WIDTH                    96
#define MG_HEALTH_INPUT_HEIGHT                   96
#define MG_HEALTH_RESIZE_MODE                    EI_CLASSIFIER_RESIZE_FIT_SHORTEST
#define MG_HEALTH_INPUT_FRAMES                   1
#define MG_HEALTH_INTERVAL_MS                    1
#define MG_HEALTH_FREQUENCY                      0

/* Output / labels */
#define MG_HEALTH_NN_OUTPUT_COUNT                3
#define MG_HEALTH_LABEL_COUNT                    3
#define MG_HEALTH_SINGLE_FEATURE_INPUT           1

/* Sensor */
#define MG_HEALTH_SENSOR                         EI_CLASSIFIER_SENSOR_CAMERA
#define MG_HEALTH_FUSION_AXES_STRING             "image"

/* Anomaly */
#define MG_HEALTH_HAS_ANOMALY                    EI_ANOMALY_TYPE_UNKNOWN

/* TFLite engine */
#define MG_HEALTH_TFLITE_INPUT_DATATYPE          EI_CLASSIFIER_DATATYPE_INT8
#define MG_HEALTH_TFLITE_OUTPUT_DATATYPE         EI_CLASSIFIER_DATATYPE_INT8
#define MG_HEALTH_THRESHOLD                      0.6
#define MG_HEALTH_TFLITE_OUTPUT_DATA_TENSOR      0
#define MG_HEALTH_OBJECT_DETECTION_LAST_LAYER    EI_CLASSIFIER_LAST_LAYER_UNKNOWN
#define MG_HEALTH_INFERENCING_ENGINE             EI_CLASSIFIER_TFLITE
#define MG_HEALTH_COMPILED                       1
#define MG_HEALTH_QUANTIZATION_ENABLED           1
#define MG_HEALTH_HAS_DATA_NORMALIZATION         0
#define MG_HEALTH_TFLITE_LARGEST_ARENA_SIZE      129049
#define MG_HEALTH_HAS_TFLITE_OPS_RESOLVER        0

/* Feature flags */
#define MG_HEALTH_HAS_FFT_INFO                   1
#define MG_HEALTH_LOAD_FFT_32                    0
#define MG_HEALTH_LOAD_FFT_64                    0
#define MG_HEALTH_LOAD_FFT_128                   0
#define MG_HEALTH_LOAD_FFT_256                   0
#define MG_HEALTH_LOAD_FFT_512                   0
#define MG_HEALTH_LOAD_FFT_1024                  0
#define MG_HEALTH_LOAD_FFT_2048                  0
#define MG_HEALTH_LOAD_FFT_4096                  0
#define MG_HEALTH_NON_STANDARD_FFT_SIZES         0
#define MG_HEALTH_HAS_VISUAL_ANOMALY             0
#define MG_HEALTH_HAS_MODEL_VARIABLES            1
#define MG_HEALTH_CALIBRATION_ENABLED            0
#define MG_HEALTH_OBJECT_TRACKING_ENABLED        0
#define MG_HEALTH_LOAD_IMAGE_SCALING             0
#define MG_HEALTH_DSP_AXES_INDEX_TYPE            uint8_t
#define MG_HEALTH_HR_ENABLED                     0
#define MG_HEALTH_EEG_ENABLED                    0
#define MG_HEALTH_OBJECT_DETECTION               0
#define MG_HEALTH_FREEFORM_OUTPUT                0
#define MG_HEALTH_HAS_ANOMALY_KMEANS             0
#define MG_HEALTH_HAS_ANOMALY_GMM                0
#define MG_HEALTH_HAS_ANOMALY_VISUAL_GMM         0
#define MG_HEALTH_HAS_ANOMALY_VISUAL_PATCHCORE   0
#define MG_HEALTH_HAS_ANOMALY_VISUAL_CUSTOM      0
#define MG_HEALTH_HAS_ANOMALY_CUSTOM             0
#define MG_HEALTH_LOAD_ANOMALY_H                 0
#define MG_HEALTH_SLICES_PER_MODEL_WINDOW        4
#define MG_HEALTH_SLICE_SIZE                     (MG_HEALTH_RAW_SAMPLE_COUNT / MG_HEALTH_SLICES_PER_MODEL_WINDOW)

#endif /* _MG_HEALTH_MODEL_METADATA_H_ */
