*** Settings ***
Library    Collections
Library    DateTime
Resource   ../erpnext_paintshop_keywords.robot

*** Keywords ***
Get Stock Ledger Entries For Voucher
    [Arguments]    ${voucher_no}
    ${filters}=    Evaluate    __import__('json').dumps([["Stock Ledger Entry","voucher_no","=","${voucher_no}"]])    json
    ${resp}=    Get ERPNext Resource    Stock Ledger Entry    filters=${filters}
    Verify Response Status    ${resp}    200
    ${entries}=    Get Response Data    ${resp}
    [Return]    ${entries}

Verify Stock Movement Recorded
    [Arguments]    ${voucher_no}
    ${entries}=    Get Stock Ledger Entries For Voucher    ${voucher_no}
    ${count}=    Get Length    ${entries}
    [Return]    ${count} > 0
