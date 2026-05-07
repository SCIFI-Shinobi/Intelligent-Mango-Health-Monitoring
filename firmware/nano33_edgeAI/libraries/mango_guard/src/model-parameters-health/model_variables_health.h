/*
 * MangoGuard unified library — Health model variables
 * Adapted from mango_health_inferencing model_variables.h (project 908354).
 * Include paths updated; header guard renamed to avoid collision with forecast model.
 *
 * Original Copyright (c) 2026 EdgeImpulse Inc.
 */

#ifndef _MG_HEALTH_MODEL_VARIABLES_H_
#define _MG_HEALTH_MODEL_VARIABLES_H_

#include <stdint.h>
#include "model_metadata_health.h"
#include "tflite-model-health/tflite_learn_908354_95_compiled.h"
#include "edge-impulse-sdk/classifier/ei_model_types.h"
#include "edge-impulse-sdk/classifier/inferencing_engines/engines.h"
#include "edge-impulse-sdk/classifier/postprocessing/ei_postprocessing_common.h"

/* ── Label strings ── */
const char* ei_classifier_inferencing_categories_908354_24[] = {
    "Anthracnose", "Healthy", "Powdery Mildew"
};

/* ── DSP block 94: image feature extraction ── */
EI_CLASSIFIER_DSP_AXES_INDEX_TYPE ei_dsp_config_908354_94_axes[] = { 0 };
const uint32_t ei_dsp_config_908354_94_axes_size = 1;
ei_dsp_config_image_t ei_dsp_config_908354_94 = {
    94,      // blockId
    1,       // implementationVersion
    1,       // length of axes
    NULL,    // named axes
    0,       // size of named axes array
    "RGB"    // select channels
};

const uint8_t ei_dsp_blocks_908354_24_size = 1;
ei_model_dsp_t ei_dsp_blocks_908354_24[ei_dsp_blocks_908354_24_size] = {
    {
        94,
        27648,                  // output size
        &extract_image_features,
        (void*)&ei_dsp_config_908354_94,
        ei_dsp_config_908354_94_axes,
        ei_dsp_config_908354_94_axes_size,
        1,       // version
        nullptr, // factory function
        nullptr, // data normalization config
    }
};

/* ── Learning block 95 (EON TFLite graph) ── */
const ei_config_tflite_eon_graph_t ei_config_graph_908354_95 = {
    .implementation_version = 1,
    .model_init   = &tflite_learn_908354_95_init,
    .model_invoke = &tflite_learn_908354_95_invoke,
    .model_reset  = &tflite_learn_908354_95_reset,
    .model_input  = &tflite_learn_908354_95_input,
    .model_output = &tflite_learn_908354_95_output,
};

const uint8_t ei_output_tensors_indices_908354_95[1] = { 0 };
const uint8_t ei_output_tensors_size_908354_95 = 1;
ei_learning_block_config_tflite_graph_t ei_learning_block_config_908354_95 = {
    .implementation_version = 1,
    .block_id = 95,
    .output_tensors_indices = ei_output_tensors_indices_908354_95,
    .output_tensors_size    = ei_output_tensors_size_908354_95,
    .quantized              = 1,
    .compiled               = 1,
    .graph_config           = (void*)&ei_config_graph_908354_95,
    .dequantize_output      = 0,
};

ei_fill_result_classification_i8_config_t ei_fill_result_classification_i8_config_908354_95 = {
    .zero_point = -128,
    .scale      = 0.00390625f
};

const uint8_t ei_learning_blocks_908354_24_size = 1;
const uint32_t ei_learning_block_908354_95_inputs[1] = { 94 };
const uint8_t  ei_learning_block_908354_95_inputs_size = 1;
const ei_learning_block_t ei_learning_blocks_908354_24[ei_learning_blocks_908354_24_size] = {
    {
        95,
        &run_nn_inference,
        (void*)&ei_learning_block_config_908354_95,
        EI_CLASSIFIER_IMAGE_SCALING_NONE,
        ei_learning_block_908354_95_inputs,
        ei_learning_block_908354_95_inputs_size,
    },
};

/* ── Post-processing ── */
const size_t ei_postprocessing_blocks_908354_24_size = 1;
const ei_postprocessing_block_t ei_postprocessing_blocks_908354_24[ei_postprocessing_blocks_908354_24_size] = {
    {
        .block_id       = 95,
        .type           = EI_CLASSIFIER_MODE_CLASSIFICATION,
        .init_fn        = NULL,
        .deinit_fn      = NULL,
        .postprocess_fn = &process_classification_i8,
        .display_fn     = NULL,
        .config         = (void*)&ei_fill_result_classification_i8_config_908354_95,
        .input_block_id = 95
    },
};

const uint8_t  freeform_outputs_908354_24_size = 0;
uint32_t      *freeform_outputs_908354_24      = nullptr;

/* ── Impulse handle ── */
const ei_impulse_t impulse_908354_24 = {
    .project_id        = 908354,
    .project_owner     = "University Program- Bahir Dar Institute of technology, Bahir Dar University: Embedded Systems, Machine Learning, IoT, IIoT",
    .project_name      = "mango health",
    .impulse_id        = 24,
    .impulse_name      = "mobile net v1",
    .deploy_version    = 8,

    .nn_input_frame_size    = 27648,
    .raw_sample_count        = 9216,
    .raw_samples_per_frame   = 1,
    .dsp_input_frame_size    = 9216 * 1,
    .input_width             = 96,
    .input_height            = 96,
    .input_frames            = 1,
    .interval_ms             = 1,
    .frequency               = 0,

    .dsp_blocks_size  = ei_dsp_blocks_908354_24_size,
    .dsp_blocks       = ei_dsp_blocks_908354_24,

    .learning_blocks_size = ei_learning_blocks_908354_24_size,
    .learning_blocks      = ei_learning_blocks_908354_24,

    .postprocessing_blocks_size = ei_postprocessing_blocks_908354_24_size,
    .postprocessing_blocks      = ei_postprocessing_blocks_908354_24,

    .output_tensors_size = 1,

    .inferencing_engine = EI_CLASSIFIER_TFLITE,
    .sensor             = EI_CLASSIFIER_SENSOR_CAMERA,
    .fusion_string      = "image",
    .slice_size         = (9216 / 4),
    .slices_per_model_window = 4,

    .has_anomaly   = EI_ANOMALY_TYPE_UNKNOWN,
    .label_count   = 3,
    .categories    = ei_classifier_inferencing_categories_908354_24,
    .results_type  = EI_CLASSIFIER_TYPE_CLASSIFICATION,
    .freeform_outputs_size = freeform_outputs_908354_24_size,
    .freeform_outputs      = freeform_outputs_908354_24
};

ei_impulse_handle_t impulse_handle_908354_24 = ei_impulse_handle_t( &impulse_908354_24 );

#endif /* _MG_HEALTH_MODEL_VARIABLES_H_ */
