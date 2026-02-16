#ifndef IMAGE_UTILS_H
#define IMAGE_UTILS_H

#include <stdint.h>
#include <stddef.h>
#include <Arduino.h>
#include <cstring>

// Structure for resize resolutions
typedef struct
{
    size_t width;
    size_t height;
} ei_device_resize_resolutions_t;

// Constants
#define FRAC_BITS 14
#define FRAC_VAL (1 << FRAC_BITS)
#define FRAC_MASK (FRAC_VAL - 1)

// Function Declarations
int calculate_resize_dimensions(uint32_t out_width, uint32_t out_height, uint32_t *resize_col_sz, uint32_t *resize_row_sz, bool *do_resize);

void resizeImage(int srcWidth, int srcHeight, uint8_t *srcImage, int dstWidth, int dstHeight, uint8_t *dstImage, int iBpp);

void cropImage(int srcWidth, int srcHeight, uint8_t *srcImage, int startX, int startY, int dstWidth, int dstHeight, uint8_t *dstImage, int iBpp);

#endif // IMAGE_UTILS_H
