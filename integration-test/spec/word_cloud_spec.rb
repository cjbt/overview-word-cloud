#!/usr/bin/env ruby

require './spec/spec_helper'

describe 'Word Cloud' do
  before do
    @user = admin_session.create_test_user
    page.log_in_as(@user)
    page.create_document_set_from_csv('files/word-cloud-spec.csv')
    page.create_custom_view(name: 'Word Cloud', url: 'http://plugin-word-cloud')
  end

  after do
    admin_session.destroy_test_user(@user)
  end

  it 'should show the word cloud' do
    page.within_frame('view-app-iframe', wait: WAIT_LOAD) do # wait for plugin to begin loading
      page.assert_selector('svg', wait: WAIT_LOAD) # wait for wordcloud to _begin_ loading
      page.assert_no_selector('progress', wait: WAIT_LOAD) # wait for wordcloud to _end_ loading

      # Test that a word appears
      page.assert_selector('text', text: 'different')

      # Test that a stopword does _not_ appear
      # (yes, we kinda roll multiple tests into one here.)
      page.assert_no_selector('text', text: 'this')
    end
  end
end
