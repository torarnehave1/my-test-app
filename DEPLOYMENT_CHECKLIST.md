# Deployment Checklist - Element Visibility Control Feature

## Pre-Deployment Testing

### Functionality Testing
- [ ] Test visibility toggle buttons appear on hover (Superadmin only)
- [ ] Test visibility panel opens when clicking toggle
- [ ] Test panel closes when clicking "Close" button
- [ ] Test individual toggle switches work
- [ ] Test all 4 elements can be toggled independently
- [ ] Test elements hide and show correctly in DOM
- [ ] Test hidden elements have reduced opacity (0.5)
- [ ] Test hidden elements have pointer-events: none

### Persistence Testing
- [ ] First save creates new settings node
- [ ] Node ID is `__CONNECT_VISIBILITY_SETTINGS__`
- [ ] Node type is `visibility-settings`
- [ ] Settings persist after page reload
- [ ] Subsequent saves update existing node
- [ ] Settings update with new timestamp
- [ ] Settings show correct `updatedBy` user
- [ ] Settings show current `updatedAt` timestamp

### Access Control Testing
- [ ] Superadmin sees toggle buttons
- [ ] Regular users don't see toggle buttons
- [ ] Non-logged-in users don't see toggle buttons
- [ ] Visibility toggles only work for Superadmin
- [ ] Save button validates Superadmin role

### Error Handling Testing
- [ ] Network error during save shows "Error!" message
- [ ] Error message allows retry
- [ ] Missing settings node handled gracefully
- [ ] Corrupted JSON in settings node doesn't crash page
- [ ] Invalid element IDs ignored safely

### Browser Compatibility Testing
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Chrome
- [ ] Mobile Safari

### API Integration Testing
- [ ] getknowgraph endpoint works
- [ ] updateknowgraph endpoint works
- [ ] Graph ID parameter working
- [ ] Node creation works
- [ ] Node update works
- [ ] Response errors handled

## Code Review

### HTML Structure
- [ ] All controllable elements have `data-element-id` attribute
- [ ] All toggle buttons have `type="button"`
- [ ] Visibility panel HTML is properly structured
- [ ] No syntax errors in HTML

### CSS Styling
- [ ] All visibility-related styles present
- [ ] Colors match design (purple accents)
- [ ] Hover effects work smoothly
- [ ] Z-index properly set for panel (999)
- [ ] No CSS conflicts with existing styles
- [ ] Responsive design (mobile-friendly)

### JavaScript Functions
- [ ] All 7 core functions implemented
- [ ] Function signatures correct
- [ ] Error handling present
- [ ] Logging statements helpful for debugging
- [ ] No circular dependencies
- [ ] No memory leaks
- [ ] Proper event listener cleanup

### Global Variables
- [ ] `visibilitySettings` initialized
- [ ] `visibilityPanelOpen` initialized
- [ ] `VISIBILITY_CONFIG_NODE_ID` set correctly
- [ ] No global namespace pollution

### Event Handlers
- [ ] Toggle button click handlers attached
- [ ] Save button click handler attached
- [ ] Close button click handler attached
- [ ] Switch toggle click handlers attached
- [ ] Event propagation handled (stopPropagation)
- [ ] No duplicate handlers

## Documentation Review

- [ ] VISIBILITY_FEATURE.md comprehensive
- [ ] VISIBILITY_USAGE.md clear and helpful
- [ ] VISIBILITY_IMPLEMENTATION.md technical details complete
- [ ] VISIBILITY_EXAMPLES.md scenarios relevant
- [ ] CHANGES_SUMMARY.md accurate
- [ ] DEPLOYMENT_CHECKLIST.md (this file) complete
- [ ] All documentation linked appropriately

## File Integrity

- [ ] connecthtml-fixed.html modified correctly
- [ ] No syntax errors in main file
- [ ] All new code properly indented
- [ ] Original functionality preserved
- [ ] File size reasonable (no bloat)
- [ ] Backup of original file saved (if applicable)

## Security Review

- [ ] Superadmin role validation implemented
- [ ] No XSS vulnerabilities (HTML escaped)
- [ ] No injection vulnerabilities
- [ ] Settings node has unique ID (no conflicts)
- [ ] No sensitive data in settings
- [ ] Audit trail includes user and timestamp
- [ ] API calls use HTTPS
- [ ] User input validated

## Performance Review

- [ ] Load time impact minimal (<100ms)
- [ ] DOM rendering performance acceptable
- [ ] CSS transitions are smooth
- [ ] No memory leaks on reload
- [ ] No unnecessary API calls
- [ ] Lazy loading not needed
- [ ] No console warnings/errors

## Database/API Considerations

- [ ] Settings node format compatible with graph schema
- [ ] Graph.nodes array handling correct
- [ ] Graph.edges array preserved
- [ ] No data corruption during save
- [ ] Concurrent save conflicts handled
- [ ] Rollback path clear if needed

## User Experience Testing

- [ ] Toggle buttons appear on hover (clear visual feedback)
- [ ] Panel appears smoothly
- [ ] Panel positioned correctly (bottom-right)
- [ ] Text is readable and properly sized
- [ ] Colors provide good contrast
- [ ] Toggle switches clearly indicate on/off state
- [ ] Save confirmation clear (status message)
- [ ] Close button easily accessible

## Accessibility Testing

- [ ] Buttons have proper `type` attribute
- [ ] Buttons have descriptive titles
- [ ] Toggle switches have clear labels
- [ ] Text has sufficient contrast ratio
- [ ] No color-only information
- [ ] Keyboard navigation works (if applicable)

## Documentation for Superadmins

- [ ] Usage guide created
- [ ] Screenshots/examples provided
- [ ] Troubleshooting section complete
- [ ] Common issues addressed
- [ ] Contact info for support clear

## Documentation for Developers

- [ ] Implementation details documented
- [ ] Code comments are clear
- [ ] Function signatures explained
- [ ] Data flow diagrams helpful
- [ ] Extension points identified
- [ ] Testing instructions provided

## Rollback Plan

- [ ] Previous version backed up
- [ ] Rollback procedure documented
- [ ] Rollback estimated time: < 5 minutes
- [ ] No data loss on rollback
- [ ] Settings node survives rollback (optional)

## Deployment Steps

1. [ ] Create backup of current connecthtml-fixed.html
2. [ ] Replace file with new version
3. [ ] Verify file size and checksum (if available)
4. [ ] Clear browser cache (or wait for CDN invalidation)
5. [ ] Test with Superadmin account
6. [ ] Test with regular user account
7. [ ] Monitor error logs for 24 hours
8. [ ] Notify users of new feature (optional)

## Post-Deployment Verification

- [ ] Feature working in production
- [ ] No console errors reported
- [ ] Toggle buttons visible to Superadmins
- [ ] Settings persist across reloads
- [ ] Existing functionality unaffected
- [ ] No performance degradation
- [ ] Users able to save settings
- [ ] Settings node appears in graphs

## Monitoring

- [ ] Set up monitoring for error logs
- [ ] Check for API errors in logs
- [ ] Monitor user feedback
- [ ] Check settings node creation
- [ ] Monitor save operation success rate
- [ ] Track usage metrics (optional)

## Communication

- [ ] Announce feature to Superadmins
- [ ] Provide link to usage guide
- [ ] Offer training session (optional)
- [ ] Create internal documentation
- [ ] Add to release notes

## Sign-Off

- [ ] QA Testing: _______________  Date: ________
- [ ] Code Review: ______________  Date: ________
- [ ] Security Review: __________  Date: ________
- [ ] Product Owner: ____________  Date: ________
- [ ] Ready to Deploy: __________  Date: ________

## Post-Deployment Review (48 hours after)

- [ ] No critical issues reported
- [ ] Users finding feature useful
- [ ] Settings saving correctly
- [ ] No performance issues
- [ ] Error logs clean
- [ ] Ready to close ticket

---

## Notes

### Known Limitations
- Settings are graph-specific (not cross-graph)
- Only one set of visibility settings per graph (not per-user)
- No versioning of settings (only latest stored)

### Future Enhancement Opportunities
- [ ] Per-user visibility preferences
- [ ] Visibility profiles (save/load presets)
- [ ] Scheduled visibility changes
- [ ] Element-specific permissions
- [ ] Mobile-optimized layouts

### Support Contacts
- Feature Owner: [Name/Email]
- Backend Support: [Team/Email]
- QA Contact: [Name/Email]
- DevOps: [Team/Email]

---

**Deployment Date**: ___________
**Deployed By**: ___________
**Deployment Status**: ⬜ Not Started | 🟡 In Progress | ✅ Complete

