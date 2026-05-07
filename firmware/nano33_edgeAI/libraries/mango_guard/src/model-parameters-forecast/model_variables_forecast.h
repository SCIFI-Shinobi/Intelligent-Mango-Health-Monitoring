/*
 * MangoGuard unified library — Forecasting model variables
 * Adapted from forcasting_inferencing model_variables.h (project 916176).
 * Include paths updated; header guard renamed to avoid collision.
 *
 * Original Copyright (c) 2026 EdgeImpulse Inc.
 */

#ifndef _MG_FORECAST_MODEL_VARIABLES_H_
#define _MG_FORECAST_MODEL_VARIABLES_H_

#include <stdint.h>
#include "model_metadata_forecast.h"
#include "tflite-model-forecast/tflite_learn_916176_105_compiled.h"
#include "edge-impulse-sdk/classifier/ei_model_types.h"
#include "edge-impulse-sdk/classifier/inferencing_engines/engines.h"
#include "edge-impulse-sdk/classifier/postprocessing/ei_postprocessing_common.h"

/* ── Label strings ── */
const char* ei_classifier_inferencing_categories_916176_2[] = {
    "High_Anthracnose_Risk", "High_Mildew_Risk", "Stable"
};

/* ── DSP block 104: raw feature extraction with standard-scaler normalisation ── */
EI_CLASSIFIER_DSP_AXES_INDEX_TYPE ei_dsp_config_916176_104_axes[] = { 0, 1 };
const uint32_t ei_dsp_config_916176_104_axes_size = 2;
ei_dsp_config_raw_t ei_dsp_config_916176_104 = {
    104, // blockId
    1,   // implementationVersion
    2,   // length of axes
    1.0f // scale-axes
};

/* Standard-scaler parameters (48 values = 24 hours × 2 axes: temperature, humidity) */
const float ei_dn_standard_scaler_mean_916176_104[48] = {
    19.91418035360896f,  59.72464751257685f,  19.912860858952136f, 59.71965426982582f,
    19.926777130277287f, 59.586032443613675f, 19.917698993387564f, 59.61369240208464f,
    19.891414696695435f, 59.75480075322097f,  19.899507584998005f, 59.733048612177164f,
    19.90672083390925f,  59.74456194032673f,  19.916256357967477f, 59.68912568250062f,
    19.926794720568513f, 59.580163115770524f, 19.913824811609256f, 59.62673683186638f,
    19.906206929289397f, 59.69195631236614f,  19.90525688510978f,  59.71296960581029f,
    19.893434230917194f, 59.77129075075857f,  19.900225240357067f, 59.79651736441336f,
    19.916798063770806f, 59.777231454010334f, 19.924503898889057f, 59.74795161931134f,
    19.90819497682275f,  59.831843042608554f, 19.916111940736926f, 59.82256554953235f,
    19.927741069847393f, 59.81613326492148f,  19.925436346066157f, 59.761567595305365f,
    19.94033782738854f,  59.5744165414492f,   19.946829728053373f, 59.48790563520288f,
    19.918064765406694f, 59.60296120197315f,  19.913719236976576f, 59.64222747351736f
};
const float ei_dn_standard_scaler_scale_916176_104[48] = {
    0.24454491952949742f, 0.04146745493199534f, 0.24377792549019073f, 0.04152406424279491f,
    0.24338906799528f,    0.041573431705264396f,0.2425040937709097f,  0.04165128860516601f,
    0.24227037233488954f, 0.04175598755923151f, 0.24226354440983666f, 0.04167749841271129f,
    0.2428754964182099f,  0.04175562861512969f, 0.2434435848508686f,  0.041830375507887756f,
    0.24145509420156466f, 0.041777563007317234f,0.24052055482342188f, 0.04173478350243688f,
    0.2388759671959129f,  0.04159086276739904f, 0.23786199336844832f, 0.04155539091936818f,
    0.23707686562077782f, 0.041487077082989744f,0.23759998234365717f, 0.04139756341237389f,
    0.2376393013811048f,  0.04132450172412713f, 0.23791927835643997f, 0.041363412606268996f,
    0.23843060337720728f, 0.041299474084776175f,0.24001179180315918f, 0.041267268942631614f,
    0.241730850404993f,   0.04114620345534126f, 0.24229318314248124f, 0.04118854916188763f,
    0.24299964209397254f, 0.041200089775377854f,0.243374281074788f,   0.04125329808824719f,
    0.24390819915019357f, 0.04130923873094623f, 0.24371259437393475f, 0.04134659004437909f
};
const float ei_dn_standard_scaler_var_916176_104[48] = {
    16.72178790353302f,  581.5475592622065f,  16.827176346390438f, 579.9630050188003f,
    16.88098813669223f,  578.5864382445475f,  17.004421091225673f, 576.4254081401722f,
    17.03724569711228f,  573.5383742732668f,  17.038206061795396f, 575.700640623466f,
    16.952454891966426f, 573.548234936765f,   16.873428312538262f, 571.500314269562f,
    17.152493163809655f, 572.9461352220646f,  17.28604367769569f,  574.1213139043175f,
    17.524881216200992f, 578.1015594969763f,  17.674612122828005f, 579.0889203353162f,
    17.79187203619329f,  580.997580028269f,   17.71361462234634f,  583.5128707435551f,
    17.707753431425825f, 585.5779953416516f,  17.666101941903374f, 584.4767980396822f,
    17.590411708762048f, 586.2879354021272f,  17.359405246791855f, 587.2033753803497f,
    17.113381825319586f, 590.6639448531605f,  17.034037888832962f, 589.4500528760308f,
    16.935137694713358f, 589.1198758048549f,  16.883039507210384f, 587.601167671926f,
    16.809206040864947f, 586.0107955759879f,  16.83619915101566f,  584.9525034043326f
};

ei_data_normalization_standard_scaler_config_t ei_data_normalization_standard_scaler_config_916176_104 = {
    .mean_data     = (float *)ei_dn_standard_scaler_mean_916176_104,
    .mean_data_len = 48,
    .scale_data    = (float *)ei_dn_standard_scaler_scale_916176_104,
    .scale_data_len= 48,
    .var_data      = (float *)ei_dn_standard_scaler_var_916176_104,
    .var_data_len  = 48
};
ei_data_normalization_t ei_data_normalization_config_916176_104 = {
    (void *) &ei_data_normalization_standard_scaler_config_916176_104,
    DATA_NORMALIZATION_METHOD_STANDARD_SCALER,
    nullptr, nullptr, nullptr,
    &data_normalization_standard_scaler
};

const uint8_t ei_dsp_blocks_916176_2_size = 1;
ei_model_dsp_t ei_dsp_blocks_916176_2[ei_dsp_blocks_916176_2_size] = {
    {
        104,
        48,
        &extract_raw_features,
        (void*)&ei_dsp_config_916176_104,
        ei_dsp_config_916176_104_axes,
        ei_dsp_config_916176_104_axes_size,
        1,
        nullptr,
        &ei_data_normalization_config_916176_104,
    }
};

/* ── Learning block 105 (EON TFLite graph) ── */
const ei_config_tflite_eon_graph_t ei_config_graph_916176_105 = {
    .implementation_version = 1,
    .model_init   = &tflite_learn_916176_105_init,
    .model_invoke = &tflite_learn_916176_105_invoke,
    .model_reset  = &tflite_learn_916176_105_reset,
    .model_input  = &tflite_learn_916176_105_input,
    .model_output = &tflite_learn_916176_105_output,
};

const uint8_t ei_output_tensors_indices_916176_105[1] = { 0 };
const uint8_t ei_output_tensors_size_916176_105 = 1;
ei_learning_block_config_tflite_graph_t ei_learning_block_config_916176_105 = {
    .implementation_version = 1,
    .block_id               = 105,
    .output_tensors_indices = ei_output_tensors_indices_916176_105,
    .output_tensors_size    = ei_output_tensors_size_916176_105,
    .quantized              = 0,
    .compiled               = 1,
    .graph_config           = (void*)&ei_config_graph_916176_105,
    .dequantize_output      = 0,
};

const uint8_t ei_learning_blocks_916176_2_size = 1;
const uint32_t ei_learning_block_916176_105_inputs[1] = { 104 };
const uint8_t  ei_learning_block_916176_105_inputs_size = 1;
const ei_learning_block_t ei_learning_blocks_916176_2[ei_learning_blocks_916176_2_size] = {
    {
        105,
        &run_nn_inference,
        (void*)&ei_learning_block_config_916176_105,
        EI_CLASSIFIER_IMAGE_SCALING_NONE,
        ei_learning_block_916176_105_inputs,
        ei_learning_block_916176_105_inputs_size,
    },
};

/* ── Post-processing ── */
const size_t ei_postprocessing_blocks_916176_2_size = 1;
const ei_postprocessing_block_t ei_postprocessing_blocks_916176_2[ei_postprocessing_blocks_916176_2_size] = {
    {
        .block_id       = 105,
        .type           = EI_CLASSIFIER_MODE_CLASSIFICATION,
        .init_fn        = NULL,
        .deinit_fn      = NULL,
        .postprocess_fn = &process_classification_f32,
        .display_fn     = NULL,
        .config         = NULL,
        .input_block_id = 105
    },
};

const uint8_t  freeform_outputs_916176_2_size = 0;
uint32_t      *freeform_outputs_916176_2      = nullptr;

/* ── Impulse handle ── */
const ei_impulse_t impulse_916176_2 = {
    .project_id        = 916176,
    .project_owner     = "University Program- Bahir Dar Institute of technology, Bahir Dar University: Embedded Systems, Machine Learning, IoT, IIoT",
    .project_name      = "forcasting",
    .impulse_id        = 2,
    .impulse_name      = "impulse #2",
    .deploy_version    = 5,

    .nn_input_frame_size    = 48,
    .raw_sample_count        = 24,
    .raw_samples_per_frame   = 2,
    .dsp_input_frame_size    = 24 * 2,
    .input_width             = 0,
    .input_height            = 0,
    .input_frames            = 0,
    .interval_ms             = 3600000,
    .frequency               = 0.0002777777777777778,

    .dsp_blocks_size  = ei_dsp_blocks_916176_2_size,
    .dsp_blocks       = ei_dsp_blocks_916176_2,

    .learning_blocks_size = ei_learning_blocks_916176_2_size,
    .learning_blocks      = ei_learning_blocks_916176_2,

    .postprocessing_blocks_size = ei_postprocessing_blocks_916176_2_size,
    .postprocessing_blocks      = ei_postprocessing_blocks_916176_2,

    .output_tensors_size = 1,

    .inferencing_engine = EI_CLASSIFIER_TFLITE,
    .sensor             = EI_CLASSIFIER_SENSOR_FUSION,
    .fusion_string      = "temperature + humidity",
    .slice_size         = (24 / 4),
    .slices_per_model_window = 4,

    .has_anomaly   = EI_ANOMALY_TYPE_UNKNOWN,
    .label_count   = 3,
    .categories    = ei_classifier_inferencing_categories_916176_2,
    .results_type  = EI_CLASSIFIER_TYPE_CLASSIFICATION,
    .freeform_outputs_size = freeform_outputs_916176_2_size,
    .freeform_outputs      = freeform_outputs_916176_2
};

ei_impulse_handle_t impulse_handle_916176_2 = ei_impulse_handle_t( &impulse_916176_2 );

#endif /* _MG_FORECAST_MODEL_VARIABLES_H_ */
