SetCompressor /SOLID lzma
SetCompressorDictSize 16

!define BASEDIR "..\..\.."
!define PRODUCT_NAME "Oxygen"
!define PRODUCT_PUBLISHER "CloudBeat, Inc."
!define PRODUCT_WEB_SITE "http://www.oxygenhq.org"
!define PRODUCT_DIR_REGKEY "Software\Microsoft\Windows\CurrentVersion\App Paths\oxygenide.exe"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
!define CHROME_EXTENSION_KEY_X86 "Software\Google\Chrome\Extensions\nddikidjcckpefjbnnnpfokienpkondf"
!define CHROME_EXTENSION_KEY_X64 "Software\Wow6432Node\Google\Chrome\Extensions\nddikidjcckpefjbnnnpfokienpkondf"
!define ENHANCED_PROTECTED_MODE_KEY "Software\Microsoft\Internet Explorer\Main"
!define IE_ZONE_KEY "Software\Microsoft\Windows\CurrentVersion\Internet Settings\Zones"
!define IE_FEATURE_BFCACHE_KEY_X86 "Software\Microsoft\Internet Explorer\Main\FeatureControl\FEATURE_BFCACHE"
!define IE_FEATURE_BFCACHE_KEY_X64 "Software\Wow6432Node\Microsoft\Internet Explorer\Main\FeatureControl\FEATURE_BFCACHE"

!include WinVer.nsh
!include x64.nsh
!include EnvVarUpdate.nsh

; MUI Settings ------
!include MUI.nsh

!define MUI_COMPONENTSPAGE_SMALLDESC
!define MUI_ABORTWARNING
!define MUI_ICON "${BASEDIR}\resources\app.ico"
!define MUI_UNICON "${BASEDIR}\resources\app.ico"

; Welcome page
!insertmacro MUI_PAGE_WELCOME
; License page
!insertmacro MUI_PAGE_LICENSE "${BASEDIR}\LICENSE"
; Components page
!insertmacro MUI_PAGE_COMPONENTS
; Directory page
!insertmacro MUI_PAGE_DIRECTORY
; Instfiles page
!insertmacro MUI_PAGE_INSTFILES
; Finish page
!define MUI_FINISHPAGE_RUN_NOTCHECKED
!define MUI_FINISHPAGE_RUN "$INSTDIR\oxygenide.exe"
!insertmacro MUI_PAGE_FINISH
; Uninstaller pages
!insertmacro MUI_UNPAGE_INSTFILES
; Prevent !warning: MUI_LANGUAGE should be inserted after the MUI_[UN]PAGE_* macros (macro:MUI_LANGUAGE:8)
!insertmacro MUI_DEFAULT MUI_PAGE_UNINSTALLER_PREFIX "" 
; Language files
!insertmacro MUI_LANGUAGE "English"

; MUI end ------

Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "${BASEDIR}\dist\oxygen-setup-${PRODUCT_VERSION}-${PRODUCT_ARCH}.exe"
InstallDir "$PROGRAMFILES\Oxygen"
InstallDirRegKey HKLM "${PRODUCT_DIR_REGKEY}" ""
ShowInstDetails show
ShowUnInstDetails show

Section "Common Files (Required)" SEC01
    SetShellVarContext all
    
    SetOverwrite ifnewer
    SetOutPath "$INSTDIR"
    ; Exclude Release folder for fibers and electron-edge
    File /r /x chromedriver /x CARoot.* /x pdf.dll /x Release "${BASEDIR}\build\*"
    File "${BASEDIR}\browser-extensions\ie\bin\Release\IEAddon.dll"
    File "${BASEDIR}\src\recorder\CARoot.cer"

    ${EnvVarUpdate} $0 "PATH" "A" "HKLM" "$INSTDIR\oxygen-cli"

    CreateDirectory "$SMPROGRAMS\Oxygen"
    CreateShortCut "$SMPROGRAMS\Oxygen\Oxygen.lnk" "$INSTDIR\oxygenide.exe"
    CreateShortCut "$DESKTOP\Oxygen.lnk" "$INSTDIR\oxygenide.exe"
    
    Call AddFirewallRule
SectionEnd

Section "Chrome Extension" SEC02
    Call RegisterExtensionChrome
SectionEnd

Section "Internet Explorer Extension" SEC03
    Call RegisterExtensionIE
SectionEnd

Section "Certificate for HTTPS recording" SEC04
    Call InstallCert
SectionEnd

Section -AdditionalIcons
  CreateShortCut "$SMPROGRAMS\Oxygen\Uninstall.lnk" "$INSTDIR\uninst.exe"
SectionEnd

Section -Post
    WriteUninstaller "$INSTDIR\uninst.exe"
    WriteRegStr HKLM "${PRODUCT_DIR_REGKEY}" "" "$INSTDIR\oxygenide.exe"
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayName" "$(^Name)"
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\uninst.exe"
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\oxygenide.exe"
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "URLInfoAbout" "${PRODUCT_WEB_SITE}"
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
SectionEnd

; Section descriptions
!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
    !insertmacro MUI_DESCRIPTION_TEXT ${SEC01} "Common files."
    !insertmacro MUI_DESCRIPTION_TEXT ${SEC02} "Enables recording support in Chrome."
    !insertmacro MUI_DESCRIPTION_TEXT ${SEC03} "Enables recording support in Internet Explorer."
    !insertmacro MUI_DESCRIPTION_TEXT ${SEC04} "Enables HTTPS recording."
!insertmacro MUI_FUNCTION_DESCRIPTION_END

Function RegisterExtensionChrome
    SetRegView 64
    WriteRegStr HKLM ${CHROME_EXTENSION_KEY_X64} "update_url" "http://clients2.google.com/service/update2/crx"
    SetRegView 32
    WriteRegStr HKLM ${CHROME_EXTENSION_KEY_X86} "update_url" "http://clients2.google.com/service/update2/crx"
FunctionEnd

Function un.RegisterExtensionChrome
    SetRegView 64
    DeleteRegKey HKLM ${CHROME_EXTENSION_KEY_X64}
    SetRegView 32
    DeleteRegKey HKLM ${CHROME_EXTENSION_KEY_X86}
FunctionEnd

Function RegisterExtensionIE
    Push $R0
    # remove any previously registered version
    ReadRegStr $R0 HKEY_LOCAL_MACHINE "Software\Microsoft\.NETFramework" "InstallRoot"

    IfFileExists $R0\v4.0.30319\regasm.exe FileExists
      MessageBox MB_ICONSTOP|MB_OK "Cannot locate regasm utility."
    Abort

    FileExists:
    nsExec::Exec '"$R0\v4.0.30319\regasm.exe" "$INSTDIR\IEAddon.dll" /silent /unregister'
    
    # register new version
    nsExec::Exec '"$R0\v4.0.30319\regasm.exe" "$INSTDIR\IEAddon.dll" /silent /codebase'

    # disable Enhanced Protected Mode on Windows 8+
    ${If} ${AtLeastWin8}
        WriteRegStr HKCU "${ENHANCED_PROTECTED_MODE_KEY}" "Isolation" "PMIL"
    ${EndIf}
    
    # disable Protected Mode for all zones
    WriteRegDWORD HKCU "${IE_ZONE_KEY}\1" "2500" 3
    WriteRegDWORD HKCU "${IE_ZONE_KEY}\2" "2500" 3
    WriteRegDWORD HKCU "${IE_ZONE_KEY}\3" "2500" 3
    WriteRegDWORD HKCU "${IE_ZONE_KEY}\4" "2500" 3
    
    # add FEATURE_BFCACHE key for IE 11
    GetDllVersion "$SYSDIR\mshtml.dll" $R1 $R2
    IntOp $R2 $R1 / 0x00010000
    StrCpy $0 "$R2" 
    ${If} $0 == "11"
        SetRegView 64
        WriteRegDWORD HKLM "${IE_FEATURE_BFCACHE_KEY_X64}" "iexplore.exe" 0
        SetRegView 32
        WriteRegDWORD HKLM "${IE_FEATURE_BFCACHE_KEY_X86}" "iexplore.exe" 0
    ${EndIf}
    
    Pop $R0
FunctionEnd

Function un.RegisterExtensionIE
    Push $R0

    ReadRegStr $R0 HKEY_LOCAL_MACHINE "Software\Microsoft\.NETFramework" "InstallRoot"

    IfFileExists $R0\v4.0.30319\regasm.exe FileExists
      MessageBox MB_ICONSTOP|MB_OK "Cannot locate regasm utility."
    Abort

    FileExists:
    nsExec::Exec '"$R0\v4.0.30319\regasm.exe" "$INSTDIR\IEAddon.dll" /silent /unregister'

    Pop $R0
FunctionEnd

Function InstallCert
    IfFileExists $WINDIR\System32\certutil.exe FileExists
      MessageBox MB_ICONSTOP|MB_OK "certutil.exe was not detected!"
    Abort

    FileExists:
    nsExec::Exec '$WINDIR\System32\certutil -addstore "Root" "$INSTDIR\CARoot.cer"'
FunctionEnd

Function un.InstallCert
    IfFileExists $WINDIR\System32\certutil.exe FileExists
      MessageBox MB_ICONSTOP|MB_OK "certutil.exe was not detected!"
    Abort

    FileExists:
    nsExec::Exec '$WINDIR\System32\certutil -delstore "Root" "eaf541d6e35e82bf449f6d21d257ec7c"'
FunctionEnd

Function AddFirewallRule
    nsExec::Exec 'netsh advfirewall firewall show rule name=Oxygen'
    Pop $R0
    ${If} $R0 != 0
        nsExec::Exec 'netsh advfirewall firewall add rule name="Oxygen" dir=in program="$INSTDIR\oxygenide.exe" protocol=TCP action=allow'
    ${EndIf}
FunctionEnd

Function un.AddFirewallRule
    nsExec::Exec 'netsh advfirewall firewall delete rule name="Oxygen" dir=in program="$INSTDIR\oxygenide.exe" protocol=TCP'
FunctionEnd


Function .onInit
  # set SEC01 section as selected and read-only
  IntOp $0 ${SF_SELECTED} | ${SF_RO}
  SectionSetFlags ${SEC01} $0
  
  Call CheckDotNet45
  Call CheckOpenApps
FunctionEnd

Function un.onUninstSuccess
  HideWindow
  MessageBox MB_ICONINFORMATION|MB_OK "Oxygen was successfully removed from your computer."
FunctionEnd

Function un.onInit
  MessageBox MB_ICONQUESTION|MB_YESNO|MB_DEFBUTTON2 "Are you sure you want to completely remove Oxygen and all of its components?" IDYES +2
  Abort
FunctionEnd

Section Uninstall
    # see http://nsis.sourceforge.net/Shortcuts_removal_fails_on_Windows_Vista
    SetShellVarContext all

    Call un.RegisterExtensionIE
    Call un.InstallCert
    Call un.AddFirewallRule
    Call un.RegisterExtensionChrome

    # remove start menu and desktop links
    Delete "$SMPROGRAMS\Oxygen\Uninstall.lnk"
    Delete "$DESKTOP\Oxygen.lnk"
    Delete "$SMPROGRAMS\Oxygen\Oxygen.lnk"
    RMDir "$SMPROGRAMS\Oxygen"
    
    # remove installation dir
    RMDir /r /REBOOTOK "$INSTDIR"
    
    # remove from PATH
    ${un.EnvVarUpdate} $0 "PATH" "R" "HKLM" "$INSTDIR\oxygen-cli"

    # remove installation reg keys
    DeleteRegKey HKLM "${PRODUCT_UNINST_KEY}"
    DeleteRegKey HKLM "${PRODUCT_DIR_REGKEY}"

    SetAutoClose true
SectionEnd

Function CheckDotNet45
    Var /GLOBAL net45ok

    ReadRegDWORD $net45ok HKLM "SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full" "Release"
    IntCmp $net45ok 378389 success failure success

    failure:
        MessageBox MB_OK|MB_ICONSTOP "Installation failed.$\n$\n\
             This software requires Microsoft .NET Framework v4.5 or higher."
        abort

    success:
FunctionEnd

!macro FindProc result processName
    nsExec::Exec 'cmd.exe /C %SystemRoot%\System32\tasklist /NH /FI "IMAGENAME eq ${processName}" | %SystemRoot%\System32\find /I "${processName}"'
    Pop ${result}
!macroend

Function CheckOpenApps
    Var /GLOBAL ieFound
    !insertmacro FindProc $ieFound "iexplore.exe"
    Var /GLOBAL oxygenFound
    !insertmacro FindProc $oxygenFound "oxygenide.exe"
    Var /GLOBAL chromeFound
    !insertmacro FindProc $chromeFound "chrome.exe"
    
    ${If} $ieFound == "0"
        StrCpy $0 "Internet Explorer$\n"
    ${Else}
        StrCpy $0 ""
    ${EndIf}
    ${If} $oxygenFound == "0"
        StrCpy $1 "Oxygen IDE$\n"
    ${Else}
        StrCpy $1 ""
    ${EndIf} 
    ${If} $chromeFound == "0"
        StrCpy $2 "Chrome$\n"
    ${Else}
        StrCpy $2 ""
    ${EndIf}
    
    ${If} $ieFound == 0
    ${OrIf} $oxygenFound == 0
    ${OrIf} $chromeFound == 0
        MessageBox MB_OK|MB_ICONSTOP "Following applications must be closed before running the setup:$\n$\n\
             $0$1$2"
        abort
    ${EndIf}
FunctionEnd