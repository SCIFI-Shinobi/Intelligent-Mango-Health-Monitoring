#ifndef CAMERA_OV7675_H
#define CAMERA_OV7675_H

#include <Arduino.h>
#include <Arduino_OV767X.h>
#include <Wire.h>
#include "Config.h"

#define DWORD_ALIGN_PTR(a)   ((a & 0x3) ?(((uintptr_t)a + 0x4) & ~(uintptr_t)0x3) : a)

class OV7675 : public OV767X {
    public:
        int begin(int resolution, int format, int fps);
        bool readFrame(void* buffer);
        
        // Members to track resize state
        uint32_t resize_col_sz;
        uint32_t resize_row_sz;

    private:
        int vsyncPin;
        int hrefPin;
        int pclkPin;
        int xclkPin;

        volatile uint32_t* vsyncPort;
        uint32_t vsyncMask;
        volatile uint32_t* hrefPort;
        uint32_t hrefMask;
        volatile uint32_t* pclkPort;
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
        
        // Removed unused intrp_buf
        // uint8_t *intrp_buf;
        
        // Removed buf_limit as it wasn't used in valid code

        bool readBuf();
        int allocate_scratch_buffs();
        int deallocate_scratch_buffs();
};

#endif // CAMERA_OV7675_H
