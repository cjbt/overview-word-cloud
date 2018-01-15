import app from './app'

const searchParams = (new URL(document.location)).searchParams

app(document.location.search, searchParams.get('server'), searchParams.get('origin'))
