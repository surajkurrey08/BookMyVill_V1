# BookMyVilla Data Entry

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users and purpose

BookMyVilla internal Data Entry staff complete villa, hotel and resort listings assigned by Admin. Success is a complete listing submitted for Admin review.

## Operating context

This separate React/Vite app runs on port 5176 and uses the existing backend on port 5000. Assignments come from the property's assignedDataEntryUser field.

## Capabilities and constraints

Staff can save private listing drafts, enter content and room/unit information, arrange photos, check required-field completion, submit for review and respond to requested changes. Admin controls approval and publication. Pricing is read-only under existing permissions. Owner reference is read-only; financial, KYC and operational information is excluded.

Backend role, active-account status, current assignment and listing-field permissions are authoritative. Existing Admin, Owner and customer UI remain outside this app's scope. The Villa Manager app belongs to a later phase.

## Brand commitments

Use the established BookMyVilla internal-console design language. Keep repetitive entry work clear and fast, without marketing pages, decorative effects or unrelated charts.
