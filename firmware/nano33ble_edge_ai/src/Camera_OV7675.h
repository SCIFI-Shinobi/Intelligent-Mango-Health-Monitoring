#ifndef CAMERA_OV7675_H
#define CAMERA_OV7675_H

#include <Arduino.h>
#include <Wire.h>
#include "Config.h"

// OV767X base class - forward declaration
// The actual class is from Arduino Mbed OS core OV7670 library
// If not available, use this stub for compilation
class OV767X
{
public:
    static bool begin(int res, int fmt, int fps)
    {
        (void)res;
        (void)fmt;
        (void)fps;
        return false;
    }
    static int width() { return 640; }
    static int height() { return 480; }
    static int bytesPerPixel() { return 2; }
};

#define DWORD_ALIGN_PTR(a) ((a & 0x3) ? (((uintptr_t)a + 0x4) & ~(uintptr_t)0x3) : a)

class OV7675 : public OV767X
{
public:
    int begin(int resolution, int format, int fps);
    void readFrame(void *buffer);

    // Members to track resize state
    uint32_t resize_col_sz;
    uint32_t resize_row_sz;

private:
    int vsyncPin;
    int hrefPin;
    int pclkPin;
    int xclkPin;

    volatile uint32_t *vsyncPort;
    uint32_t vsyncMask;
    volatile uint32_t *hrefPort;
    uint32_t hrefMask;
    volatile uint32_t *pclkPort;
    uint32_t pclkMask;

    uint16_t width;
    uint16_t height;
    uint8_t bytes_per_pixel;
    uint16_t bytes_per_row;
    uint8_t buf_rows;
    uint16_t buf_size;
    uint8_t resize_height;
    uint8_t *raw_buf;
    void *buf_mem;

    void readBuf();
    int allocate_scratch_buffs();
    int deallocate_scratch_buffs();
};

#endif // CAMERA_OV7675_H
