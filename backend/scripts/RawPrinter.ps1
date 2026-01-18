# Raw Printer Script - Sends raw ESC/POS data to Windows printer
# Usage: .\RawPrinter.ps1 -PrinterName "EPSON TM-T20IIL" -FilePath "C:\temp\data.bin"

param(
    [Parameter(Mandatory=$true)]
    [string]$PrinterName,
    
    [Parameter(Mandatory=$true)]
    [string]$FilePath
)

# Add-Type for P/Invoke to winspool.drv
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class RawPrinter
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct DOCINFO
    {
        [MarshalAs(UnmanagedType.LPWStr)]
        public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)]
        public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)]
        public string pDataType;
    }

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr hPrinter, IntPtr pDefault);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern int StartDocPrinter(IntPtr hPrinter, int level, ref DOCINFO pDocInfo);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);

    public static bool SendBytesToPrinter(string printerName, byte[] bytes)
    {
        IntPtr hPrinter = IntPtr.Zero;
        int dwWritten = 0;
        bool success = false;

        try
        {
            if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero))
            {
                throw new Exception("Failed to open printer: " + printerName + ". Error: " + Marshal.GetLastWin32Error());
            }

            DOCINFO docInfo = new DOCINFO();
            docInfo.pDocName = "ESC/POS Raw Document";
            docInfo.pOutputFile = null;
            docInfo.pDataType = "RAW";

            if (StartDocPrinter(hPrinter, 1, ref docInfo) == 0)
            {
                throw new Exception("StartDocPrinter failed. Error: " + Marshal.GetLastWin32Error());
            }

            if (!StartPagePrinter(hPrinter))
            {
                throw new Exception("StartPagePrinter failed. Error: " + Marshal.GetLastWin32Error());
            }

            if (!WritePrinter(hPrinter, bytes, bytes.Length, out dwWritten))
            {
                throw new Exception("WritePrinter failed. Error: " + Marshal.GetLastWin32Error());
            }

            EndPagePrinter(hPrinter);
            EndDocPrinter(hPrinter);
            success = true;
        }
        finally
        {
            if (hPrinter != IntPtr.Zero)
            {
                ClosePrinter(hPrinter);
            }
        }

        return success;
    }
}
"@

# Verify file exists
if (-not (Test-Path $FilePath)) {
    throw "File not found: $FilePath"
}

# Read binary data from file
$bytes = [System.IO.File]::ReadAllBytes($FilePath)

# Send to printer
try {
    $result = [RawPrinter]::SendBytesToPrinter($PrinterName, $bytes)
    if ($result) {
        Write-Output "SUCCESS: Sent $($bytes.Length) bytes to printer '$PrinterName'"
        exit 0
    } else {
        throw "Unknown error sending data to printer"
    }
} catch {
    Write-Error "ERROR: $_"
    exit 1
}
